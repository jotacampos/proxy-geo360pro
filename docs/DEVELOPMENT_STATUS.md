# Proxy Geo360 Pro - Status de Desenvolvimento

**Data:** Janeiro 2026
**Versão:** 1.0.0-dev

---

## Visão Geral

Sistema de proxy para tiles vetoriais dinâmicas com suporte a análises espaciais em tempo real. O sistema permite servir tiles MVT (Mapbox Vector Tiles) de qualquer tabela PostgreSQL/PostGIS com controle granular de campos e otimizações por zoom.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (Browser)                              │
│                              OpenLayers                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OpenResty (nginx + Lua)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Autenticação│  │    Cache    │  │    ETag     │  │    CORS     │    │
│  │    JWT      │  │  proxy_cache│  │  304 Not    │  │   Headers   │    │
│  │             │  │   7 dias    │  │  Modified   │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Martin Tile Server                                │
│                    (Executa funções PostgreSQL)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL + PostGIS                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ get_dynamic_tile │  │ get_dynamic_tile │  │ get_dynamic_tile │      │
│  │    _simplify     │  │  _intersection   │  │     _buffer      │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Funções SQL Implementadas

### 1. get_dynamic_tile_simplify

Tiles dinâmicas com otimização por zoom (simplificação de geometria e limite de features).

**Arquivo:** `sql/02_create_dynamic_tile_simplify.sql`

**Parâmetros:**
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| schema | string | Não | cadastro | Schema da tabela |
| table | string | Sim | - | Nome da tabela |
| geom | string | Sim | - | Coluna de geometria |
| srid | integer | Sim | - | SRID da geometria |
| fields | string | Não | todos | Campos (separados por vírgula) |

**Otimizações por Zoom:**
| Zoom | Simplificação | Limite Features |
|------|---------------|-----------------|
| ≤ 8 | ~1100m | 500 |
| ≤ 10 | ~550m | 1.000 |
| ≤ 12 | ~110m | 2.000 |
| ≤ 14 | ~11m | 5.000 |
| > 14 | Nenhuma | 10.000 |

**Endpoint:** `/tiles/dynamic-optimized/{z}/{x}/{y}.pbf`

---

### 2. get_dynamic_tile_intersection

Calcula interseção espacial entre duas camadas e retorna como tiles.

**Arquivo:** `sql/03_create_dynamic_tile_intersection.sql`

**Parâmetros:**
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| schema1 | string | Não | cadastro | Schema da tabela 1 |
| table1 | string | Sim | - | Nome da tabela 1 |
| geom1 | string | Sim | - | Coluna de geometria 1 |
| srid1 | integer | Sim | - | SRID da geometria 1 |
| fields1 | string | Não | todos | Campos da tabela 1 |
| schema2 | string | Não | cadastro | Schema da tabela 2 |
| table2 | string | Sim | - | Nome da tabela 2 |
| geom2 | string | Sim | - | Coluna de geometria 2 |
| srid2 | integer | Sim | - | SRID da geometria 2 |
| fields2 | string | Não | todos | Campos da tabela 2 |
| layer_name | string | Não | intersection | Nome da layer no MVT |

**Restrições:**
- Zoom mínimo: 10 (JOIN espacial é pesado)
- Campos de saída têm prefixo `l1_` e `l2_`

**Otimizações:**
- ST_MakeValid para corrigir geometrias inválidas
- Simplificação antes do JOIN
- Limite de features por zoom (100 a 2000)

**Endpoint:** `/tiles/dynamic-intersection/{z}/{x}/{y}.pbf`

---

### 3. get_dynamic_tile_buffer

Cria área de influência (buffer) ao redor das geometrias.

**Arquivo:** `sql/04_create_dynamic_tile_buffer.sql`

**Parâmetros:**
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| schema | string | Não | cadastro | Schema da tabela |
| table | string | Sim | - | Nome da tabela |
| geom | string | Sim | - | Coluna de geometria |
| srid | integer | Sim | - | SRID da geometria |
| fields | string | Não | todos | Campos a retornar |
| buffer_meters | float | Não | 100 | Distância do buffer em metros |
| buffer_segments | integer | Não | 8 | Qualidade dos cantos |
| dissolve | boolean | Não | false | Unir buffers sobrepostos |
| layer_name | string | Não | buffer | Nome da layer no MVT |

**Casos de Uso:**
- Área de influência de postes (iluminação)
- Faixa de servidão de redes (água, esgoto)
- Proximidade de equipamentos públicos
- Análise de APP (Área de Preservação Permanente)

**Endpoint:** `/tiles/dynamic-buffer/{z}/{x}/{y}.pbf`

---

## Rotas do Proxy (OpenResty)

### Tiles Dinâmicas

| Rota | Descrição | Cache |
|------|-----------|-------|
| `/tiles/dynamic/{z}/{x}/{y}.pbf` | Tiles dinâmicas básicas | 7 dias |
| `/tiles/dynamic-optimized/{z}/{x}/{y}.pbf` | Tiles com simplificação | 7 dias |
| `/tiles/dynamic-intersection/{z}/{x}/{y}.pbf` | Interseção de duas camadas | 7 dias |
| `/tiles/dynamic-buffer/{z}/{x}/{y}.pbf` | Buffer de uma camada | 7 dias |

### Parâmetro NoCache

Todas as rotas suportam `?nocache=1` para bypass do cache:
```
/tiles/dynamic-buffer/14/5948/8960.pbf?schema=ctm&table=cdo_quadra&geom=geom&srid=4326&buffer_meters=100&nocache=1
```

### Outras Rotas

| Rota | Descrição |
|------|-----------|
| `/tiles/{municipio}/{layer}/{z}/{x}/{y}.pbf` | Tiles estáticas |
| `/tiles/cache/purge/dynamic/{schema}/{table}` | Purge cache por tabela |
| `/tiles/cache/purge/dynamic/bbox` | Purge cache por bbox (POST) |
| `/api/...` | Proxy para backend API |
| `/storage/{bucket}/{path}` | Proxy para MinIO |
| `/health` | Health check |

---

## Viewer de Teste

**URL:** `http://localhost:8081/viewer/`

### Funcionalidades

1. **Login e Seleção de Organização**
   - Autenticação JWT
   - Seleção de organização multi-tenant

2. **Camadas Pré-configuradas**
   - Lista de layers da organização
   - Toggle on/off
   - Versão original e otimizada

3. **Teste Manual**
   - Schema, tabela, coluna de geometria
   - Botões Original/Otimizada
   - Checkbox NoCache
   - Refresh e Limpar camadas

4. **Teste de Interseção**
   - Duas camadas com campos opcionais
   - Checkbox NoCache
   - Zoom mínimo: 10

5. **Teste de Buffer**
   - Uma camada + distância em metros
   - Opção Dissolver (unir buffers)
   - Checkbox NoCache

6. **Ferramenta Identificar**
   - Clique no mapa para ver atributos
   - Navegação entre múltiplas features
   - Formatação de valores

7. **Refresh Global**
   - Botão no header
   - Recarrega todas as camadas

---

## Configuração Martin

**Arquivo:** `martin/config.yml`

```yaml
listen_addresses: '0.0.0.0:3000'

cors:
  origin: ['*']

postgres:
  - connection_string: '${DATABASE_URL}'
    default_srid: 4326
    pool_size: 5
    auto_publish:
      tables: false
      functions:
        from_schemas:
          - public
        id_format: '{function}'
    functions:
      get_dynamic_tile_simplify:
        schema: public
        function: get_dynamic_tile_simplify
      get_dynamic_tile_intersection:
        schema: public
        function: get_dynamic_tile_intersection
      get_dynamic_tile_buffer:
        schema: public
        function: get_dynamic_tile_buffer

cache_size_mb: 0  # Desabilitado em dev
```

---

## Ambiente de Desenvolvimento

### Comandos

```bash
# Iniciar ambiente dev
docker compose -f docker-compose.dev.yml up -d

# Ver logs
docker compose -f docker-compose.dev.yml logs -f openresty
docker compose -f docker-compose.dev.yml logs -f martin

# Rebuild após mudanças no nginx
docker compose -f docker-compose.dev.yml build openresty
docker compose -f docker-compose.dev.yml up -d openresty

# Testar função diretamente
curl -s "http://localhost:3030/get_dynamic_tile_buffer/14/5948/8960?schema=ctm&table=cdo_quadra&geom=geom&srid=4326&buffer_meters=100" | wc -c

# Limpar cache nginx
docker compose -f docker-compose.dev.yml exec openresty rm -rf /tmp/tiles_cache/*
```

### Portas

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| OpenResty | 8081 | Proxy principal |
| Martin | 3030 | Tile server (direto) |
| PostgreSQL | 5433 | Banco local (dev) |
| MinIO Console | 9001 | Storage (dev) |

### Banco de Dados Remoto

O ambiente dev conecta ao banco remoto:
- Host: `10.61.112.11:5433`
- Database: `ladm_goiania_teste`
- Schema principal: `ctm`

---

## Tabelas Disponíveis (Schema CTM)

| Tabela | Tipo | Tamanho | Descrição |
|--------|------|---------|-----------|
| cdo_foto_360 | POINT | 346 MB | Fotos 360° |
| ldm_poligono | POLYGON | 214 MB | Polígonos diversos |
| cdo_geo360_esg_esgoto | GEOMETRY | 70 MB | Rede de esgoto |
| cdo_geo360_pst_poste | POINT | 68 MB | Postes |
| cdo_geo360_h2o_abastecimento_agua_potavel | GEOMETRY | 39 MB | Rede de água |
| cdo_quadra | POLYGON | 19 MB | Quadras |
| cdo_geo360_app_area_protecao_permanente | POLYGON | 4.3 MB | APP |
| cdo_bairro | POLYGON | 2.4 MB | Bairros |
| cdo_face_quadra | LINE | 4.4 MB | Faces de quadra |

---

## Exemplos de Uso

### Buffer de 100m em Quadras

```bash
curl "http://localhost:8081/tiles/dynamic-buffer/14/5948/8960.pbf?\
schema=ctm&\
table=cdo_quadra&\
geom=geom&\
srid=4326&\
buffer_meters=100&\
fields=id"
```

### Interseção Quadras x APP

```bash
curl "http://localhost:8081/tiles/dynamic-intersection/14/5948/8960.pbf?\
schema1=ctm&table1=cdo_quadra&geom1=geom&srid1=4326&fields1=id&\
schema2=ctm&table2=cdo_geo360_app_area_protecao_permanente&geom2=geom&srid2=4326&fields2=id"
```

### Tiles Otimizadas

```bash
curl "http://localhost:8081/tiles/dynamic-optimized/10/596/947.pbf?\
schema=ctm&\
table=ldm_poligono&\
geom=geom&\
srid=4326"
```

---

## Próximos Passos

### Pendente

- [ ] Função de Diferença espacial (A - B)
- [ ] Função de União/Dissolve por atributo
- [ ] Função de Centroide
- [ ] Cache distribuído (Redis)
- [ ] Métricas de performance
- [ ] Testes automatizados

### Melhorias Futuras

- [ ] Suporte a múltiplos SRIDs de entrada
- [ ] Agregação espacial (count/sum por região)
- [ ] Export de resultados (GeoJSON, Shapefile)
- [ ] Histórico de análises
- [ ] Compartilhamento de visualizações

---

## Estrutura de Arquivos

```
proxy-geo360pro/
├── docker-compose.dev.yml      # Ambiente de desenvolvimento
├── docker-compose.yml          # Produção
├── docs/
│   └── DEVELOPMENT_STATUS.md   # Este documento
├── martin/
│   └── config.yml              # Configuração Martin
├── openresty/
│   ├── Dockerfile
│   ├── nginx.conf.template     # Config nginx com variáveis
│   └── lua/
│       ├── auth.lua            # Autenticação JWT
│       ├── cors.lua            # Headers CORS
│       ├── etag_dynamic.lua    # ETag e 304
│       ├── cache_invalidation.lua
│       └── cache_purge_dynamic.lua
├── sql/
│   ├── 01_create_dynamic_tile.sql
│   ├── 02_create_dynamic_tile_simplify.sql
│   ├── 03_create_dynamic_tile_intersection.sql
│   └── 04_create_dynamic_tile_buffer.sql
├── viewer/
│   └── index.html              # Viewer de teste
└── CLAUDE.md                   # Instruções para Claude Code
```

---

## Changelog

### v1.0.0-dev (Janeiro 2026)

- Implementação inicial do proxy OpenResty
- Função `get_dynamic_tile` para tiles dinâmicas
- Função `get_dynamic_tile_simplify` com otimização por zoom
- Função `get_dynamic_tile_intersection` para análise espacial
- Função `get_dynamic_tile_buffer` para área de influência
- Viewer de teste com todas as funcionalidades
- Ferramenta de identificação de atributos
- Suporte a NoCache para bypass de cache
- Botão de refresh para recarregar camadas

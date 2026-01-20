# Proxy Geo360Pro

Proxy unificado para múltiplos serviços backend (Martin, MinIO, API) com suporte a tiles vetoriais dinâmicos e controle de acesso granular por campo.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRODUÇÃO                                       │
│                                                                          │
│  ┌─────────────┐                                                        │
│  │  OpenResty  │──→ MARTIN_URL  ──→ Martin (Tile Server)                │
│  │   (proxy)   │──→ MINIO_URL   ──→ MinIO (Storage)                     │
│  │   :8080     │──→ BACKEND_URL ──→ API Backend                         │
│  └─────────────┘                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         DESENVOLVIMENTO                                  │
│                                                                          │
│  ┌─────────────┐     ┌─────────────────────────────────┐                │
│  │  OpenResty  │──→  │  Serviços locais simulados      │                │
│  │   :8081     │     │  - martin:3000 (interno)        │                │
│  │             │     │  - minio:9000                   │                │
│  └─────────────┘     │  - postgres:5433 (local)        │                │
│                      └─────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Funcionalidades Principais

### Proxy OpenResty (Core)

| Funcionalidade | Descrição |
|----------------|-----------|
| **Tiles Dinâmicos** | Geração de MVT com seleção de campos |
| **Autenticação JWT** | Validação via subrequest com cache |
| **Cache com ETag** | Cache inteligente com invalidação espacial |
| **CORS** | Suporte completo a cross-origin |
| **Purge de Cache** | Por tabela ou bounding box |

### Funções PostgreSQL/PostGIS

| Função | Endpoint | Descrição |
|--------|----------|-----------|
| `get_dynamic_tile` | `/tiles/dynamic/` | Tiles básicos com seleção de campos |
| `get_dynamic_tile_simplify` | `/tiles/dynamic-optimized/` | Simplificação por zoom |
| `get_dynamic_tile_intersection` | `/tiles/dynamic-intersection/` | Join espacial de 2 camadas |
| `get_dynamic_tile_buffer` | `/tiles/dynamic-buffer/` | Buffer em geometrias |

### Viewers (Secundário)

| Viewer | Porta | Descrição |
|--------|-------|-----------|
| `viewer/` | 8081 | Preview simples com OpenLayers |
| `viewer-deckgl/` | 5173 | Visualização básica deck.gl |
| `viewer-editor/` | 5174 | Editor GIS completo com ferramentas de desenho |

## Stack Tecnológico

| Componente | Tecnologia | Versão |
|------------|------------|--------|
| Proxy | OpenResty (Nginx + Lua) | 1.27.1+ |
| Tile Server | Martin | v0.15.0+ |
| Banco de Dados | PostgreSQL + PostGIS | 16 + 3.5 |
| Storage | MinIO | latest |
| Container | Docker Compose | v2+ |

## Quick Start

### Desenvolvimento

```bash
# Iniciar ambiente de desenvolvimento (porta 8081)
docker compose -f docker-compose.dev.yml up -d

# Ver logs
docker compose -f docker-compose.dev.yml logs -f openresty

# Testar tiles dinâmicos
./test_dynamic_tiles.sh

# Testar seleção de campos
./test_fields.sh

# Executar todos os testes
./run_tests.sh
```

### Produção

```bash
# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com URLs reais dos serviços

# Iniciar (porta 8080)
docker compose up -d
```

## Rotas da API

### Tiles

```bash
# Tiles dinâmicos com seleção de campos
GET /tiles/dynamic/{z}/{x}/{y}.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao

# Tiles otimizados (simplificação por zoom)
GET /tiles/dynamic-optimized/{z}/{x}/{y}.pbf?...

# Interseção de duas camadas
GET /tiles/dynamic-intersection/{z}/{x}/{y}.pbf?schema1=...&table1=...&schema2=...&table2=...

# Buffer
GET /tiles/dynamic-buffer/{z}/{x}/{y}.pbf?...&buffer_meters=100

# Tiles estáticos (Martin)
GET /tiles/{municipio}/{layer}/{z}/{x}/{y}.pbf
```

### Cache

```bash
# Purge por tabela
GET /tiles/cache/purge/dynamic/{schema}/{table}

# Purge por bbox
POST /tiles/cache/purge/dynamic/bbox
Content-Type: application/json
{
  "schema": "cadastro",
  "table": "lotes",
  "bbox": {
    "min_lon": -48.92,
    "min_lat": -27.12,
    "max_lon": -48.88,
    "max_lat": -27.08
  }
}

# Estatísticas de cache
GET /tiles/cache/stats
```

### Outros

```bash
# Health check (sem auth)
GET /health

# Debug de autenticação
GET /debug/auth

# Proxy para API backend
GET /api/...

# Proxy para MinIO
GET /storage/{bucket}/{path}
```

## Autenticação

O sistema suporta autenticação via:

| Método | Header/Cookie |
|--------|---------------|
| Cookie | `jwt-access-cookie` (preferido) |
| Header | `Authorization: Bearer <JWT>` |

Para rotas `/api/*`, também é necessário o header `X-Organization` (UUID).

**Rotas públicas (sem auth):** `/health`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`

## Estrutura do Projeto

```
proxy-geo360pro/
├── openresty/
│   ├── nginx.conf.template    # Config Nginx com ${VAR} substituição
│   ├── Dockerfile
│   └── lua/
│       ├── auth.lua           # Validação JWT + cache
│       ├── etag_dynamic.lua   # ETag e 304 Not Modified
│       ├── cache_invalidation.lua  # Invalidação espacial
│       ├── cache_purge_dynamic.lua # Purge por tabela/bbox
│       ├── cors.lua           # Headers CORS
│       └── utils.lua          # Utilitários
├── sql/
│   ├── 00_init_dev_data.sql   # Dados de teste
│   ├── 01_create_dynamic_tile.sql
│   ├── 02_create_dynamic_tile_simplify.sql
│   ├── 03_create_dynamic_tile_intersection.sql
│   └── 04_create_dynamic_tile_buffer.sql
├── martin/
│   └── config.yml             # Config do Martin
├── viewer/                    # OpenLayers viewer
├── viewer-deckgl/             # deck.gl viewer
├── viewer-editor/             # Editor GIS completo
├── doc/
│   └── TROUBLESHOOTING_TILES_AUTH.md
├── docker-compose.yml         # Produção
├── docker-compose.dev.yml     # Desenvolvimento
└── CLAUDE.md                  # Instruções para AI
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão Dev |
|----------|-----------|------------|
| `MARTIN_URL` | URL do Martin | `http://martin:3000` |
| `MINIO_URL` | URL do MinIO | `http://minio:9000` |
| `BACKEND_URL` | URL da API backend | `https://api.geo360pro.topocart.dev.br/v2` |
| `BACKEND_HOST` | Host header para backend | `api.geo360pro.topocart.dev.br` |

## Viewers

### Viewer Editor (Completo)

Editor GIS completo com:
- Interface Ribbon (estilo Microsoft Office)
- Painéis dockáveis (FlexLayout)
- Ferramentas de desenho (ponto, linha, polígono, retângulo, círculo)
- Ferramentas de edição (modificar, mover, rotacionar, escalar)
- Sistema de snap avançado (vértices, arestas, guias, interseções)
- Análise espacial (buffer, união, diferença, interseção)
- Medição (distância, área)
- Undo/Redo com histórico visual

```bash
cd viewer-editor
npm install
npm run dev
# http://localhost:5174
```

## Notas Importantes

- **Gzip desabilitado** para endpoints de tiles (MVT não pode ser comprimido com gzip)
- Martin exposto na porta **3030** para debug direto
- Em dev, cookies são reescritos para funcionar com HTTP localhost

## Documentação

- [CLAUDE.md](CLAUDE.md) - Instruções completas do projeto
- [DYNAMIC_TILES_SPEC.md](DYNAMIC_TILES_SPEC.md) - Especificação de tiles dinâmicos
- [doc/TROUBLESHOOTING_TILES_AUTH.md](doc/TROUBLESHOOTING_TILES_AUTH.md) - Debug de auth/CORS
- [viewer-editor/doc/DEVELOPMENT_STATUS.md](viewer-editor/doc/DEVELOPMENT_STATUS.md) - Status do editor

## Licença

Proprietário - Geo360 / Topocart

# Especificação: Dynamic Tiles - Função Genérica com Controle de Campos

> **Documento para iniciar novo projeto Claude**
> Este documento contém toda a especificação para implementar tiles dinâmicas com controle granular de campos.

## Contexto do Problema

A aplicação possui **permissões granulares por campo** onde cada usuário/grupo pode ver apenas determinados campos de uma tabela. O frontend já tem o contexto dessas permissões.

**Objetivo:** Criar função PostgreSQL genérica que receba via URL:
- Nome da tabela
- Schema
- Campos permitidos (baseado nas permissões do usuário)
- Coluna de geometria
- SRID fonte

**Controle:** Frontend define os parâmetros baseado nas permissões do usuário.
**Validação:** Backend valida existência via `information_schema` (não permissões).
**Escopo:** Bancos de municípios (não plataforma vm2).

---

## Stack Tecnológica

| Componente | Tecnologia | Versão |
|------------|------------|--------|
| Tile Server | Martin | v0.15.0+ |
| Proxy/Cache | OpenResty | 1.27.1+ |
| Database | PostgreSQL + PostGIS | 16 + 3.5 |
| Linguagem Proxy | Lua (LuaJIT) | 2.1 |
| Container | Docker Compose | v2+ |

---

## Resumo

O Martin **pode sim** desabilitar o auto-discovery de tabelas e usar apenas funções personalizadas. Já existe um exemplo funcionando no projeto: `vm2.martin_get_vector_tile`.

### Desabilitar Auto-Discovery de Tabelas

No `config.yaml`, usar `tables: false`:

```yaml
postgres:
  - connection_string: 'postgresql://...'
    auto_publish:
      tables: false              # Desabilita descoberta de tabelas
      functions:
        from_schemas: [meu_schema]
        id_format: '{function}'
```

### Assinatura da Função Martin

O Martin aceita duas assinaturas:

```sql
-- Básica (sem query params)
FUNCTION minha_func(z integer, x integer, y integer) RETURNS bytea

-- Com query params (recomendada)
FUNCTION minha_func(z integer, x integer, y integer, query json) RETURNS bytea
```

---

## Implementação: Função PostgreSQL

### Parâmetros da URL

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `table` | string | Sim | Nome da tabela (sem schema) |
| `schema` | string | Não | Schema (default: 'cadastro') |
| `fields` | array | Não | Campos a retornar (default: todos) |
| `geom` | string | Sim | Nome da coluna de geometria |
| `srid` | integer | Sim | SRID fonte da geometria |

### URL de Uso

```
# Completo
/tiles/dynamic/14/5966/9474.pbf?schema=cadastro&table=lote&geom=geom&srid=4326&fields=id,inscricao,area

# Com schema default (cadastro)
/tiles/dynamic/14/5966/9474.pbf?table=lote&geom=geom&srid=4326&fields=id,inscricao

# Tabela com SRID diferente (ex: SIRGAS 2000)
/tiles/dynamic/14/5966/9474.pbf?table=lote&geom=geometria&srid=31984&fields=id,cod
```

### Função SQL Completa

```sql
-- Arquivo: sql/01_create_dynamic_tile.sql

CREATE OR REPLACE FUNCTION public.get_dynamic_tile(
    z integer,
    x integer,
    y integer,
    query json DEFAULT '{}'::json
) RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    v_schema text;
    v_table text;
    v_geom_column text;
    v_srid integer;
    v_fields text;
    v_fields_arr text[];
    v_result bytea;
    v_field text;
    v_tile_bounds geometry;
    v_source_bounds geometry;
BEGIN
    -- 1. Extrai parâmetros obrigatórios
    v_schema := COALESCE(query->>'schema', 'cadastro');
    v_table := query->>'table';
    v_geom_column := query->>'geom';
    v_srid := (query->>'srid')::integer;

    -- Validação de parâmetros obrigatórios
    IF v_table IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "table" é obrigatório';
    END IF;
    IF v_geom_column IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "geom" é obrigatório';
    END IF;
    IF v_srid IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "srid" é obrigatório';
    END IF;

    -- 2. VALIDAÇÃO: Verifica se tabela existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema
        AND table_name = v_table
    ) THEN
        RAISE EXCEPTION 'Tabela %.% não existe', v_schema, v_table;
    END IF;

    -- 3. VALIDAÇÃO: Verifica se coluna de geometria existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema
        AND table_name = v_table
        AND column_name = v_geom_column
    ) THEN
        RAISE EXCEPTION 'Coluna % não existe em %.%', v_geom_column, v_schema, v_table;
    END IF;

    -- 4. Processa campos
    IF query->>'fields' IS NOT NULL AND query->>'fields' != '' THEN
        -- Campos específicos (separados por vírgula)
        v_fields_arr := string_to_array(query->>'fields', ',');

        -- Valida cada campo
        FOREACH v_field IN ARRAY v_fields_arr LOOP
            v_field := trim(v_field);
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = v_schema
                AND table_name = v_table
                AND column_name = v_field
            ) THEN
                RAISE EXCEPTION 'Coluna % não existe em %.%', v_field, v_schema, v_table;
            END IF;
        END LOOP;

        -- Monta string de campos com trim
        SELECT string_agg(trim(f), ', ') INTO v_fields
        FROM unnest(v_fields_arr) AS f;
    ELSE
        -- Todos os campos (exceto geometria)
        SELECT string_agg(column_name, ', ') INTO v_fields
        FROM information_schema.columns
        WHERE table_schema = v_schema
        AND table_name = v_table
        AND column_name != v_geom_column
        AND udt_name NOT IN ('geometry', 'geography');
    END IF;

    -- 5. Calcula bounds da tile
    v_tile_bounds := ST_TileEnvelope(z, x, y);
    v_source_bounds := ST_Transform(v_tile_bounds, v_srid);

    -- 6. Executa query dinâmica
    EXECUTE format(
        'SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
            SELECT
                ST_AsMVTGeom(
                    ST_Transform(%I, 3857),
                    $1,
                    4096, 64, true
                ) AS geom,
                %s
            FROM %I.%I
            WHERE %I && $2
        ) AS tile WHERE geom IS NOT NULL',
        v_table,                -- layer name no MVT
        v_geom_column,          -- coluna de geometria
        v_fields,               -- campos selecionados
        v_schema,               -- schema
        v_table,                -- tabela
        v_geom_column           -- coluna para filtro espacial
    ) INTO v_result USING v_tile_bounds, v_source_bounds;

    RETURN COALESCE(v_result, ''::bytea);
END;
$$;

COMMENT ON FUNCTION public.get_dynamic_tile IS
'Função dinâmica para tiles. Params: schema, table, geom, srid, fields';
```

---

## Ambiente de Desenvolvimento Local

### PostgreSQL Local para Testes

```yaml
# docker-compose.dev.yml
services:
  postgres-dev:
    image: postgis/postgis:16-3.5
    container_name: postgres-dev
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: teste_tiles
    ports:
      - "5433:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d

volumes:
  postgres_dev_data:
```

### Dados de Teste

```sql
-- sql/00_init_dev_data.sql

CREATE SCHEMA IF NOT EXISTS cadastro;

-- Tabela de teste com SRID 4326
CREATE TABLE cadastro.lote_teste (
    id SERIAL PRIMARY KEY,
    inscricao VARCHAR(50),
    area NUMERIC(12,2),
    valor_venal NUMERIC(14,2),  -- campo "sensível"
    bairro VARCHAR(100),
    geom GEOMETRY(Polygon, 4326)
);

INSERT INTO cadastro.lote_teste (inscricao, area, valor_venal, bairro, geom) VALUES
('001.001.0001', 500.00, 150000.00, 'Centro',
 ST_GeomFromText('POLYGON((-48.92 -27.10, -48.92 -27.101, -48.919 -27.101, -48.919 -27.10, -48.92 -27.10))', 4326)),
('001.001.0002', 750.00, 225000.00, 'Centro',
 ST_GeomFromText('POLYGON((-48.919 -27.10, -48.919 -27.101, -48.918 -27.101, -48.918 -27.10, -48.919 -27.10))', 4326)),
('001.002.0001', 300.00, 90000.00, 'Azambuja',
 ST_GeomFromText('POLYGON((-48.925 -27.105, -48.925 -27.106, -48.924 -27.106, -48.924 -27.105, -48.925 -27.105))', 4326));

CREATE INDEX idx_lote_teste_geom ON cadastro.lote_teste USING GIST (geom);

-- Tabela com SRID diferente (SIRGAS 2000 / UTM 22S)
CREATE TABLE cadastro.edificacao_teste (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    pavimentos INTEGER,
    geometria GEOMETRY(Polygon, 31982)
);

INSERT INTO cadastro.edificacao_teste (tipo, pavimentos, geometria) VALUES
('Residencial', 2, ST_GeomFromText('POLYGON((714000 6998000, 714000 6998010, 714010 6998010, 714010 6998000, 714000 6998000))', 31982));

CREATE INDEX idx_edificacao_teste_geom ON cadastro.edificacao_teste USING GIST (geometria);
```

### Comandos para Ambiente Dev

```bash
# Subir PostgreSQL de desenvolvimento
docker compose -f docker-compose.dev.yml up -d postgres-dev

# Criar a função dinâmica
psql -h localhost -p 5433 -U dev -d teste_tiles -f sql/01_create_dynamic_tile.sql

# Testar a função diretamente no PostgreSQL
psql -h localhost -p 5433 -U dev -d teste_tiles -c "
SELECT length(public.get_dynamic_tile(16, 23864, 37896,
  '{\"schema\":\"cadastro\",\"table\":\"lote_teste\",\"geom\":\"geom\",\"srid\":4326,\"fields\":\"id,inscricao,area\"}'::json
)) as tile_size;
"
```

---

## Configuração Martin

```yaml
# martin/config.yml
postgres:
  - connection_string: 'postgresql://dev:dev@postgres-dev:5432/teste_tiles'
    auto_publish:
      tables: false
      functions:
        from_schemas: [public]
        id_format: '{function}'
```

---

## Implementação Lua (OpenResty)

### Estrutura de Arquivos

```
lua/
├── etag_dynamic.lua           # ETag para tiles dinâmicas
├── cache_purge_dynamic.lua    # Purge por bbox/tabela
├── cache_invalidation.lua     # Invalidação espacial (reutilizar)
├── cors.lua                   # CORS headers (reutilizar)
└── utils.lua                  # Utilitários (reutilizar)
```

### 1. etag_dynamic.lua

```lua
-- etag_dynamic.lua - ETag para tiles dinâmicas usando subrequest
local _M = {}

local function parse_uri(uri)
    local path, args = uri:match("^([^?]+)%??(.*)$")
    return path or uri, args ~= "" and args or nil
end

function _M.fetch_with_etag(internal_uri, args_string)
    local path, _ = parse_uri(internal_uri)

    local res = ngx.location.capture(path, {
        method = ngx.HTTP_GET,
        args = args_string,
        always_forward_body = false
    })

    if res.status == 204 then
        ngx.status = 204
        ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
        ngx.header["Cache-Control"] = "public, no-cache"
        return
    end

    if res.status >= 400 then
        ngx.status = res.status
        ngx.header["Content-Type"] = "application/json"
        if res.body then ngx.print(res.body) end
        return
    end

    local body = res.body
    if not body or #body == 0 then
        ngx.status = 204
        ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
        ngx.header["Cache-Control"] = "public, no-cache"
        return
    end

    local etag = '"' .. ngx.md5(body) .. '"'
    local if_none_match = ngx.var.http_if_none_match

    if if_none_match and if_none_match == etag then
        ngx.status = 304
        ngx.header["ETag"] = etag
        ngx.header["Cache-Control"] = "public, no-cache"
        return
    end

    ngx.status = 200
    ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
    ngx.header["Content-Length"] = #body
    ngx.header["ETag"] = etag
    ngx.header["Cache-Control"] = "public, no-cache"
    ngx.print(body)
end

function _M.fetch_bypass(internal_uri, args_string)
    local path, _ = parse_uri(internal_uri)

    local res = ngx.location.capture(path, {
        method = ngx.HTTP_GET,
        args = args_string,
        always_forward_body = false
    })

    ngx.status = res.status

    if res.status == 200 and res.body and #res.body > 0 then
        ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
        ngx.header["Content-Length"] = #res.body
        ngx.header["Cache-Control"] = "no-store"
        ngx.print(res.body)
    elseif res.status == 204 then
        ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
        ngx.header["Cache-Control"] = "no-store"
    else
        ngx.header["Content-Type"] = "application/json"
        ngx.header["Cache-Control"] = "no-store"
        if res.body then ngx.print(res.body) end
    end
end

return _M
```

### 2. cache_purge_dynamic.lua

```lua
-- cache_purge_dynamic.lua - Invalidação de cache para tiles dinâmicas
local _M = {}

local CACHE_PATH = "/tmp/tiles_cache"
local cache_inv = require("cache_invalidation")

local function validate_schema(schema)
    if not schema or schema == "" then return "cadastro" end
    if not schema:match("^[%w_]+$") then return nil, "schema contém caracteres inválidos" end
    if #schema > 50 then return nil, "schema muito longo" end
    return schema
end

local function validate_table(tbl)
    if not tbl or tbl == "" then return nil, "table não pode ser vazio" end
    if not tbl:match("^[%w_]+$") then return nil, "table contém caracteres inválidos" end
    if #tbl > 100 then return nil, "table muito longo" end
    return tbl
end

local function validate_fields(fields)
    if not fields or fields == "" then return nil end
    for field in fields:gmatch("[^,]+") do
        field = field:match("^%s*(.-)%s*$")
        if not field:match("^[%w_]+$") then
            return nil, "campo '" .. field .. "' contém caracteres inválidos"
        end
    end
    return fields
end

local function validate_bbox(bbox)
    if not bbox then return nil, "bbox não pode ser nulo" end
    local min_lon = tonumber(bbox.min_lon)
    local min_lat = tonumber(bbox.min_lat)
    local max_lon = tonumber(bbox.max_lon)
    local max_lat = tonumber(bbox.max_lat)

    if not min_lon or not min_lat or not max_lon or not max_lat then
        return nil, "bbox deve ter min_lon, min_lat, max_lon, max_lat"
    end
    if min_lon < -180 or max_lon > 180 then return nil, "longitude inválida" end
    if min_lat < -90 or max_lat > 90 then return nil, "latitude inválida" end
    if min_lon >= max_lon then return nil, "min_lon deve ser menor que max_lon" end
    if min_lat >= max_lat then return nil, "min_lat deve ser menor que max_lat" end

    return { min_lon = min_lon, min_lat = min_lat, max_lon = max_lon, max_lat = max_lat }
end

function _M.lat_lon_to_tile(lat, lon, zoom)
    local n = 2 ^ zoom
    local x = math.floor((lon + 180) / 360 * n)
    local lat_rad = math.rad(lat)
    local y = math.floor((1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n)
    return x, y
end

function _M.bbox_to_tiles(bbox, min_zoom, max_zoom)
    local tiles = {}
    for z = min_zoom, max_zoom do
        local x1, y1 = _M.lat_lon_to_tile(bbox.max_lat, bbox.min_lon, z)
        local x2, y2 = _M.lat_lon_to_tile(bbox.min_lat, bbox.max_lon, z)
        if x1 > x2 then x1, x2 = x2, x1 end
        if y1 > y2 then y1, y2 = y2, y1 end
        for x = x1, x2 do
            for y = y1, y2 do
                table.insert(tiles, { z = z, x = x, y = y })
            end
        end
    end
    return tiles
end

local DOUBLE_PURGE_DELAY = 1.5

local function purge_by_pattern(pattern)
    local find_cmd = string.format("grep -r -l 'KEY: %s' %s 2>/dev/null", pattern, CACHE_PATH)
    local handle = io.popen(find_cmd)
    if not handle then return false, 0 end
    local files = handle:read("*a")
    handle:close()
    if files == "" then return true, 0 end

    local count = 0
    for file in files:gmatch("[^\n]+") do
        os.remove(file)
        count = count + 1
    end
    return true, count
end

local function double_purge_by_pattern(pattern)
    local ok1, count1 = purge_by_pattern(pattern)
    ngx.sleep(DOUBLE_PURGE_DELAY)
    local ok2, count2 = purge_by_pattern(pattern)
    local total = (count1 or 0) + (count2 or 0)
    return ok1 and ok2, string.format("%d files removed (purge1=%d, purge2=%d)", total, count1 or 0, count2 or 0)
end

function _M.purge_table(schema, tbl)
    local valid_schema, err1 = validate_schema(schema)
    if err1 then return false, err1 end
    local valid_table, err2 = validate_table(tbl)
    if not valid_table then return false, err2 end

    local pattern = string.format("dynamic:%s:%s:", valid_schema, valid_table)
    return double_purge_by_pattern(pattern)
end

function _M.purge_bbox(schema, tbl, fields, bbox, min_zoom, max_zoom)
    local valid_schema, err1 = validate_schema(schema)
    if err1 then return false, { error = err1 } end
    local valid_table, err2 = validate_table(tbl)
    if not valid_table then return false, { error = err2 } end
    local valid_fields, err3 = validate_fields(fields)
    if err3 then return false, { error = err3 } end
    local valid_bbox, err4 = validate_bbox(bbox)
    if not valid_bbox then return false, { error = err4 } end

    min_zoom = math.max(tonumber(min_zoom) or 12, 0)
    max_zoom = math.min(tonumber(max_zoom) or 18, 23)
    if min_zoom > max_zoom then return false, { error = "min_zoom > max_zoom" } end

    local tiles = _M.bbox_to_tiles(valid_bbox, min_zoom, max_zoom)
    if #tiles > 50000 then return false, { error = "bbox muito grande" } end

    -- Registra invalidação espacial
    cache_inv.register_dynamic_invalidation(valid_schema, valid_table, valid_fields, valid_bbox)

    -- Purge
    local pattern = string.format("dynamic:%s:%s:", valid_schema, valid_table)
    local find_cmd = string.format("grep -r -l 'KEY: %s' %s 2>/dev/null", pattern, CACHE_PATH)
    local handle = io.popen(find_cmd)
    if not handle then
        return true, { purged = 0, total_tiles = #tiles, spatial_invalidation = true }
    end

    local files = handle:read("*a")
    handle:close()

    local purged = 0
    for file in files:gmatch("[^\n]+") do
        local f = io.open(file, "r")
        if f then
            local first_line = f:read("*l")
            f:close()
            if first_line then
                local cache_key = first_line:match("KEY: ([^\n]+)")
                if cache_key then
                    local z, x, y = cache_key:match(":(%d+):(%d+):(%d+)$")
                    if z then
                        z, x, y = tonumber(z), tonumber(x), tonumber(y)
                        if z >= min_zoom and z <= max_zoom then
                            for _, tile in ipairs(tiles) do
                                if tile.z == z and tile.x == x and tile.y == y then
                                    if not valid_fields or cache_key:find(valid_fields, 1, true) then
                                        os.remove(file)
                                        purged = purged + 1
                                    end
                                    break
                                end
                            end
                        end
                    end
                end
            end
        end
    end

    return true, { purged = purged, total_tiles = #tiles, spatial_invalidation = true }
end

return _M
```

### 3. Funções adicionais para cache_invalidation.lua

```lua
-- Adicionar ao módulo cache_invalidation.lua existente

function _M.register_dynamic_invalidation(schema, tbl, fields, bbox)
    local dict = ngx.shared.spatial_invalidations
    if not dict then return false end

    local now = ngx.now()
    local key = string.format("dynamic:%s:%s:%s:%f", schema, tbl, fields or "*", now)

    local data = cjson.encode({ bbox = bbox, time = now })
    local ok, err = dict:set(key, data, INVALIDATION_TTL)
    if not ok then
        ngx.log(ngx.ERR, "failed to register dynamic invalidation: ", err)
        return false
    end
    return true
end

function _M.should_cache_dynamic(schema, tbl, fields, z, x, y, request_start)
    local dict = ngx.shared.spatial_invalidations
    if not dict then return true end

    local keys = dict:get_keys(MAX_KEYS)
    if #keys == 0 then return true end

    local prefix = string.format("dynamic:%s:%s:", schema, tbl)
    local prefix_len = #prefix
    local tile_bbox = nil

    for _, key in ipairs(keys) do
        if key:sub(1, prefix_len) == prefix then
            local data = dict:get(key)
            if data then
                local ok, inv = pcall(cjson.decode, data)
                if ok and request_start < inv.time then
                    if not tile_bbox then
                        tile_bbox = _M.tile_to_bbox(z, x, y)
                    end
                    if _M.intersects(tile_bbox, inv.bbox) then
                        return false
                    end
                end
            end
        end
    end
    return true
end
```

---

## Configuração nginx.conf

```nginx
# Shared dict para invalidação espacial
lua_shared_dict spatial_invalidations 10m;

# Cache zones
proxy_cache_path /tmp/tiles_cache levels=1:2 keys_zone=tiles_cache:100m
                 max_size=10g inactive=7d use_temp_path=off;

# Tiles dinâmicas - Rota principal
location ~ ^/tiles/dynamic/(\d+)/(\d+)/(\d+)\.pbf$ {
    set $z $1;
    set $x $2;
    set $y $3;

    set_by_lua_block $dyn_schema {
        return ngx.var.arg_schema or "cadastro"
    }

    set $bypass_cache 0;
    if ($arg_nocache = "1") { set $bypass_cache 1; }
    if ($arg_fresh = "1") { set $bypass_cache 1; }

    set $cache_key "dynamic:$dyn_schema:$arg_table:$arg_fields:$z:$x:$y";

    if ($bypass_cache = "1") {
        rewrite ^ /@dynamic_bypass last;
    }

    content_by_lua_block {
        local etag = require("etag_dynamic")
        local cache_inv = require("cache_invalidation")

        local args = string.format(
            "schema=%s&table=%s&geom=%s&srid=%s&fields=%s",
            ngx.var.arg_schema or "cadastro",
            ngx.var.arg_table or "",
            ngx.var.arg_geom or "",
            ngx.var.arg_srid or "",
            ngx.var.arg_fields or ""
        )

        local request_start = ngx.now()
        etag.fetch_with_etag("/@martin_dynamic_internal", args)

        local should_cache = cache_inv.should_cache_dynamic(
            ngx.var.arg_schema or "cadastro",
            ngx.var.arg_table or "",
            ngx.var.arg_fields or "",
            tonumber(ngx.var.z),
            tonumber(ngx.var.x),
            tonumber(ngx.var.y),
            request_start
        )

        if not should_cache then
            ngx.header["X-Cache-Skipped"] = "spatial-invalidation"
        end
    }

    add_header X-Cache-Status $upstream_cache_status always;
    add_header X-Cache-Key $cache_key always;
}

location = /@dynamic_bypass {
    internal;
    content_by_lua_block {
        local etag = require("etag_dynamic")
        local args = string.format(
            "schema=%s&table=%s&geom=%s&srid=%s&fields=%s",
            ngx.var.arg_schema or "cadastro",
            ngx.var.arg_table or "",
            ngx.var.arg_geom or "",
            ngx.var.arg_srid or "",
            ngx.var.arg_fields or ""
        )
        etag.fetch_bypass("/@martin_dynamic_internal", args)
    }
}

location = /@martin_dynamic_internal {
    internal;
    proxy_pass http://martin:3000/get_dynamic_tile/$z/$x/$y$is_args$args;
    proxy_cache tiles_cache;
    proxy_cache_key $cache_key;
    proxy_cache_valid 200 7d;
    proxy_cache_valid 204 1h;
    proxy_no_cache $upstream_http_x_cache_skipped;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}

# Purge por tabela
location ~ ^/cache/purge/dynamic/([^/]+)/([^/]+)$ {
    set $purge_schema $1;
    set $purge_table $2;
    content_by_lua_block {
        local purge = require("cache_purge_dynamic")
        local cjson = require("cjson")
        local ok, result = purge.purge_table(ngx.var.purge_schema, ngx.var.purge_table)
        ngx.header["Content-Type"] = "application/json"
        if ok then
            ngx.say(cjson.encode({ success = true, result = result }))
        else
            ngx.status = 400
            ngx.say(cjson.encode({ success = false, error = result }))
        end
    }
}

# Purge por bbox
location = /cache/purge/dynamic/bbox {
    content_by_lua_block {
        local purge = require("cache_purge_dynamic")
        local cjson = require("cjson")

        ngx.req.read_body()
        local body = ngx.req.get_body_data()
        if not body then
            ngx.status = 400
            ngx.header["Content-Type"] = "application/json"
            ngx.say(cjson.encode({ success = false, error = "body vazio" }))
            return
        end

        local ok_parse, data = pcall(cjson.decode, body)
        if not ok_parse then
            ngx.status = 400
            ngx.header["Content-Type"] = "application/json"
            ngx.say(cjson.encode({ success = false, error = "JSON inválido" }))
            return
        end

        local ok, result = purge.purge_bbox(
            data.schema, data.table, data.fields,
            data.bbox, data.min_zoom, data.max_zoom
        )

        ngx.header["Content-Type"] = "application/json"
        if ok then
            ngx.say(cjson.encode({ success = true, result = result }))
        else
            ngx.status = 400
            ngx.say(cjson.encode({ success = false, error = result.error }))
        end
    }
}
```

---

## Cache e Purge

### Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| Cache Zone | `tiles_cache` (mesmo das tiles normais) |
| TTL | 7 dias |
| Cache Key | `dynamic:schema:table:fields:z:x:y` |
| Bypass read | `?fresh=1` |
| Bypass total | `?nocache=1` |
| ETag | MD5 do body |
| 304 Not Modified | Sim |

### Endpoints de Purge

```bash
# Purge por tabela
GET /cache/purge/dynamic/{schema}/{table}

# Purge por bbox
POST /cache/purge/dynamic/bbox
{
  "schema": "cadastro",
  "table": "lote",
  "fields": "id,inscricao,area",  # opcional
  "bbox": {"min_lon": -48.92, "min_lat": -27.12, "max_lon": -48.88, "max_lat": -27.08},
  "min_zoom": 12,
  "max_zoom": 18
}
```

---

## Exemplos de Uso

```bash
# Tile com campos específicos
curl "http://localhost:8080/tiles/dynamic/16/23864/37896.pbf?schema=cadastro&table=lote&geom=geom&srid=4326&fields=id,inscricao,area"

# ETag (304 Not Modified)
ETAG=$(curl -sI "http://localhost:8080/tiles/dynamic/16/23864/37896.pbf?schema=cadastro&table=lote&geom=geom&srid=4326&fields=id,inscricao" | grep -i etag | cut -d' ' -f2)
curl -H "If-None-Match: $ETAG" "http://localhost:8080/tiles/dynamic/16/23864/37896.pbf?..."

# Bypass cache
curl "http://localhost:8080/tiles/dynamic/16/23864/37896.pbf?...&nocache=1"

# Purge por tabela
curl "http://localhost:8080/cache/purge/dynamic/cadastro/lote"

# Purge por bbox
curl -X POST "http://localhost:8080/cache/purge/dynamic/bbox" \
  -H "Content-Type: application/json" \
  -d '{"schema":"cadastro","table":"lote","bbox":{"min_lon":-48.92,"min_lat":-27.12,"max_lon":-48.88,"max_lat":-27.08},"min_zoom":12,"max_zoom":18}'
```

---

## Fluxo Completo

```
1. Frontend carrega permissões do usuário
   → Usuário pode ver: lote (id, inscricao, area) - NÃO valor_venal
   → Tabela usa: geom (SRID 4326)

2. Frontend monta URL com parâmetros permitidos:
   GET /tiles/dynamic/16/23864/37896.pbf?schema=cadastro&table=lote&geom=geom&srid=4326&fields=id,inscricao,area

3. OpenResty:
   → Verifica cache (key = dynamic:cadastro:lote:id,inscricao,area:16:23864:37896)
   → Se miss, proxy para Martin

4. Martin chama public.get_dynamic_tile():
   → Valida tabela/campos via information_schema
   → Gera MVT apenas com campos solicitados
   → Transforma de SRID fonte (4326) para 3857

5. Tile retorna com apenas: id, inscricao, area (sem valor_venal)
```

---

## Estrutura do Novo Projeto

```
dynamic-tiles/
├── docker-compose.yml              # PostgreSQL + Martin + OpenResty
├── docker-compose.dev.yml          # Apenas PostgreSQL (testes iniciais)
├── .env.example
├── sql/
│   ├── 00_init_dev_data.sql
│   └── 01_create_dynamic_tile.sql
├── martin/
│   └── config.yml
├── openresty/
│   ├── nginx.conf
│   ├── Dockerfile
│   └── lua/
│       ├── etag_dynamic.lua
│       ├── cache_purge_dynamic.lua
│       ├── cache_invalidation.lua
│       └── cors.lua
└── docs/
    └── README.md
```

---

## Passos de Implementação

1. [ ] Criar novo diretório/repo para o projeto
2. [ ] Configurar ambiente dev (PostgreSQL local)
3. [ ] Implementar e testar função SQL `get_dynamic_tile`
4. [ ] Configurar Martin para usar apenas funções
5. [ ] Implementar rotas no OpenResty com cache
6. [ ] Implementar purge por bbox
7. [ ] Implementar invalidação espacial
8. [ ] Testar ETag/304
9. [ ] Documentar API
10. [ ] Integrar com frontend (permissões → URL)

---

## Considerações

1. **Performance**: Cada request faz queries em `information_schema` - cache de 7 dias compensa
2. **Novas tabelas/colunas**: Funcionam automaticamente (validação dinâmica)
3. **Segurança**: Frontend controla campos baseado em permissões
4. **Cache**: Key inclui schema+table+fields para cache granular
5. **SRID flexível**: Suporta qualquer SRID (4326, 31982, 31984, etc)
6. **Purge BBOX**: Mesma lógica de tiles normais, adaptada para dynamic
7. **ETag/304**: Reutiliza padrão do projeto principal

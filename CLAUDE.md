# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unified proxy for multiple backend services (Martin, MinIO, API) with dynamic vector tile support and granular field-level access control. All backend services are external - this proxy only routes requests to them via environment variables.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PRODUCTION                              │
│  ┌─────────────┐                                            │
│  │  OpenResty  │──→ MARTIN_URL  ──→ external Martin         │
│  │   (proxy)   │──→ MINIO_URL   ──→ external MinIO          │
│  │             │──→ BACKEND_URL ──→ external API            │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT                                │
│  ┌─────────────┐     ┌─────────────────────────────────┐    │
│  │  OpenResty  │──→  │  Simulated local services       │    │
│  │   (proxy)   │     │  - martin:3000 (internal)       │    │
│  │             │     │  - minio:9000                   │    │
│  └─────────────┘     │  - postgres:5433 (local)        │    │
│                      └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Tile Server | Martin | v0.15.0+ |
| Proxy/Cache | OpenResty | 1.27.1+ |
| Database | PostgreSQL + PostGIS | 16 + 3.5 |
| Storage | MinIO | latest |
| Proxy Language | Lua (LuaJIT) | 2.1 |
| Container | Docker Compose | v2+ |

## Viewers

| Viewer | Path | Port | Purpose |
|--------|------|------|---------|
| OpenLayers | `viewer/` | 8081/viewer/ | Simple tile preview (served by OpenResty) |
| deck.gl Simple | `viewer-deckgl/` | 5173 | Basic tile visualization (React + Vite) |
| Full Editor | `viewer-editor/` | 5174 | Complete GIS editor with drawing tools |

## Common Commands

```bash
# Development (with local simulated services) - exposes port 8081
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f openresty

# Run all tests
./run_tests.sh

# Quick tile tests
./test_dynamic_tiles.sh

# Test fields selection
./test_fields.sh

# Production (external services) - exposes port 8080
cp .env.example .env
# Edit .env with real service URLs
docker compose up -d

# Rebuild OpenResty after Lua/nginx changes (no hot-reload for nginx.conf)
docker compose -f docker-compose.dev.yml build openresty
docker compose -f docker-compose.dev.yml up -d openresty

# Hot-reload Lua modules (volumes mounted in dev)
docker compose -f docker-compose.dev.yml exec openresty nginx -s reload

# Test PostgreSQL function directly
psql -h localhost -p 5433 -U dev -d teste_tiles -c "
SELECT length(public.get_dynamic_tile(16, 23864, 37896,
  '{\"schema\":\"cadastro\",\"table\":\"lote_teste\",\"geom\":\"geom\",\"srid\":4326,\"fields\":\"id,inscricao,area\"}'::json
)) as tile_size;"

# Debug: check nginx config syntax
docker compose -f docker-compose.dev.yml exec openresty nginx -t

# Debug: view Martin catalog
curl -s http://localhost:8081/health | jq
curl -s http://localhost:3030/catalog | jq  # Direct to Martin (port 3030)

# Debug: check cache stats
curl -s http://localhost:8081/tiles/cache/stats | jq

# Viewer (deck.gl simple) - separate dev server
cd viewer-deckgl && npm install && npm run dev  # http://localhost:5173

# Viewer (editor) - full GIS editor with drawing tools
cd viewer-editor && npm install && npm run dev  # http://localhost:5174 (different port)
```

## Viewer Editor (viewer-editor/)

Full-featured GIS editor built with React 18, deck.gl 9, @deck.gl-community/editable-layers, and FlexLayout.

**Tech:** React 18, Vite 6, deck.gl 9 + MapLibre GL, Zustand, Tailwind CSS 3.4, Lucide React

**Layout:** Ribbon toolbar (Microsoft Office style), dockable panels (FlexLayout), attribute table

**State Management:** Zustand stores in `stores/` - editor state, UI state, layer state, map state

**Drawing:** Uses `@deck.gl-community/editable-layers` for geometry creation and editing (points, lines, polygons, rectangles, circles, etc.)

**History:** Non-sequential undo/redo allowing reverting any specific operation by ID

**Commands:**
```bash
cd viewer-editor
npm install && npm run dev   # http://localhost:5174
npm run typecheck            # Type checking
```

**Docs:** `viewer-editor/doc/` contains UI_LAYOUT_PLAN.md, TOOL_MAPPING.md, DEVELOPMENT_PROGRESS.md

## Lua Modules Architecture

The proxy logic is implemented in Lua modules under `openresty/lua/`:

| Module | Purpose |
|--------|---------|
| `auth.lua` | JWT validation via backend subrequest, token caching based on JWT `exp` |
| `etag_dynamic.lua` | ETag generation (MD5 of body) and 304 Not Modified responses |
| `cache_invalidation.lua` | Spatial invalidation to prevent race conditions during purge |
| `cache_purge_dynamic.lua` | Cache purge by table or bbox with tile coordinate calculation |
| `cors.lua` | CORS headers for cross-origin requests |
| `utils.lua` | Shared utilities |

**Key concept - Spatial Invalidation**: When a bbox purge is triggered, the system registers the invalidation region. Any tile request that started before the purge but completes after won't be cached (prevents stale data from race conditions).

**Key concept - JWT Caching**: Tokens are cached using their `exp` claim as TTL. Cache auto-invalidates on logout/password-change routes.

## Dynamic Tile Request Flow

```
Frontend (with user permissions)
    │
    ▼  GET /tiles/dynamic/16/23864/37896.pbf?schema=cadastro&table=lote&geom=geom&srid=4326&fields=id,inscricao
    │
OpenResty (nginx.conf.template:140-209)
    │  1. Extracts z/x/y from URL
    │  2. Builds cache_key = "dynamic:schema:table:fields:z:x:y"
    │  3. Checks spatial invalidation (cache_invalidation.lua)
    │  4. Generates ETag from response (etag_dynamic.lua)
    │
    ▼  Proxy to Martin
    │
Martin Tile Server
    │  GET /get_dynamic_tile/16/23864/37896?schema=...&table=...
    │
    ▼  Calls PostgreSQL function
    │
public.get_dynamic_tile() (sql/01_create_dynamic_tile.sql)
    │  1. Validates table/columns via information_schema
    │  2. Builds dynamic SQL with only requested fields
    │  3. Transforms geometry from source SRID → 3857
    │  4. Returns MVT bytea
    │
    ▼
Response: .pbf tile with only permitted fields
```

## Route Pattern

```
/api/...                                           → Backend API proxy (requires JWT + X-Organization)
/tiles/{municipio}/{layer}/{z}/{x}/{y}.pbf         → Static tiles (Martin)
/tiles/dynamic/{z}/{x}/{y}.pbf                     → Dynamic tiles with field control
/tiles/dynamic-optimized/{z}/{x}/{y}.pbf           → Dynamic tiles with zoom-based simplification
/tiles/dynamic-intersection/{z}/{x}/{y}.pbf        → Intersection of two layers
/tiles/dynamic-buffer/{z}/{x}/{y}.pbf              → Buffer around geometries
/tiles/cache/purge/dynamic/{schema}/{table}        → Purge by table
/tiles/cache/purge/dynamic/bbox                    → Purge by bounding box (POST)
/tiles/cache/stats                                 → Cache statistics
/auth/cache/stats                                  → JWT cache statistics
/storage/{bucket}/{path}                           → MinIO files proxy
/health                                            → Health check (no auth)
/debug/auth                                        → Debug auth token info
/viewer/                                           → Dev tile viewer (static files)
```

**Public routes** (no auth required): `/health`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`

## API Examples

```bash
# Dynamic tiles (dev port 8081, prod port 8080)
curl "http://localhost:8081/tiles/dynamic/16/23864/37896.pbf?schema=cadastro&table=lote_teste&geom=geom&srid=4326&fields=id,inscricao"

# Static tiles
curl "http://localhost:8081/tiles/brusque/cadastro.lote/14/5966/9474.pbf"

# Cache bypass
curl "http://localhost:8081/tiles/dynamic/16/23864/37896.pbf?schema=cadastro&table=lote_teste&geom=geom&srid=4326&nocache=1"

# Purge by table
curl "http://localhost:8081/tiles/cache/purge/dynamic/cadastro/lote_teste"

# Purge by bbox
curl -X POST "http://localhost:8081/tiles/cache/purge/dynamic/bbox" \
  -H "Content-Type: application/json" \
  -d '{"schema":"cadastro","table":"lote_teste","bbox":{"min_lon":-48.92,"min_lat":-27.12,"max_lon":-48.88,"max_lat":-27.08}}'
```

## Environment Variables

| Variable | Description | Dev Default |
|----------|-------------|-------------|
| `MARTIN_URL` | Martin tile server URL | `http://martin:3000` |
| `MINIO_URL` | MinIO storage URL | `http://minio:9000` |
| `BACKEND_URL` | Backend API URL | `https://api.geo360pro.topocart.dev.br/v2` |
| `BACKEND_HOST` | Backend host for Host header | `api.geo360pro.topocart.dev.br` |

## Development Database

The dev environment uses **two databases**:
- **Local PostgreSQL** on port **5433** for test data (`teste_tiles` database)
- **Remote Martin database** at `10.61.112.11:5433` (`ladm_goiania_teste`) for real tile data

Connect to local dev database:
```bash
psql -h localhost -p 5433 -U dev -d teste_tiles

# Test dynamic tile function
psql -h localhost -p 5433 -U dev -d teste_tiles -c "
SELECT length(public.get_dynamic_tile(16, 23864, 37896,
  '{\"schema\":\"cadastro\",\"table\":\"lotes\",\"geom\":\"geom\",\"srid\":4326,\"fields\":\"id,inscricao\"}'::json
)) as tile_size;"
```

## Cache Key Patterns

Cache files stored in `/tmp/tiles_cache` with keys:

| Type | Pattern | Example |
|------|---------|---------|
| Dynamic | `dynamic:{schema}:{table}:{fields}:{z}:{x}:{y}` | `dynamic:cadastro:lotes:id,inscricao:16:23864:37896` |
| Static | `{municipio}:{layer}:{z}:{x}:{y}` | `brusque:cadastro.lote:14:5966:9474` |

Debug cache with:
```bash
# Check if tile is cached
grep -r "KEY: dynamic:cadastro:lotes" /tmp/tiles_cache 2>/dev/null | head -5

# View response headers for cache status
curl -sI "http://localhost:8081/tiles/dynamic/16/23864/37896.pbf?..." | grep -E "(X-Cache|ETag)"
```

## SQL Functions (PostGIS)

These functions run in PostgreSQL and are called via Martin tile server:

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `get_dynamic_tile` | `/tiles/dynamic/` | Basic tiles with field selection |
| `get_dynamic_tile_simplify` | `/tiles/dynamic-optimized/` | Zoom-based geometry simplification |
| `get_dynamic_tile_intersection` | `/tiles/dynamic-intersection/` | Spatial join of two layers |
| `get_dynamic_tile_buffer` | `/tiles/dynamic-buffer/` | Buffer around geometries |

**Common parameters** (query string):
- `schema` - PostgreSQL schema (default: `cadastro`)
- `table` - Table name (required)
- `geom` - Geometry column name (required)
- `srid` - Source SRID (required, auto-transforms to 3857)
- `fields` - Comma-separated field list (optional, defaults to all)

**Intersection-specific**: `schema1/table1/geom1/srid1/fields1` + `schema2/table2/geom2/srid2/fields2`

**Buffer-specific**: `buffer_meters` (default 100), `buffer_segments` (default 8), `dissolve` (default false)

## Key Files

- `DYNAMIC_TILES_SPEC.md`: Complete implementation specification with SQL function details
- `sql/00_init_dev_data.sql`: Schema and test data for local dev database
- `sql/01_create_dynamic_tile.sql`: PostgreSQL function `get_dynamic_tile()` for dynamic MVT
- `sql/02_api_geo360_base_tables.sql`: Core GIS table definitions for api-geo360
- `sql/02_create_dynamic_tile_simplify.sql`: Optimized function with zoom-based geometry simplification
- `sql/03_create_dynamic_tile_intersection.sql`: Two-layer intersection tile function
- `sql/04_create_dynamic_tile_buffer.sql`: Buffer generation tile function
- `openresty/nginx.conf.template`: Nginx config with `${VAR}` substitution via envsubst
- `run_tests.sh`: Comprehensive test suite for all tile scenarios
- `doc/TROUBLESHOOTING_TILES_AUTH.md`: Known issues with JWT cookies, CORS, gzip and MVT
- `docs/DEVELOPMENT_STATUS.md`: Current implementation status and pending features

## Authentication Flow

1. Frontend sends JWT via `jwt-access-cookie` cookie (preferred) or `Authorization: Bearer` header
2. `auth.lua` extracts token and checks shared dict cache (`jwt_cache`)
3. Cache miss → subrequest to `/@auth_me` → `$BACKEND_URL/api/auth/me`
4. Response cached using JWT `exp` claim as TTL
5. For `/api/*` routes: also requires `X-Organization` header (UUID)

**Dev workaround**: Cookies are rewritten in dev to remove `Secure` flag and change `SameSite=none` to `SameSite=Lax` (HTTP localhost doesn't support Secure cookies).

## Important Notes

- **Gzip must be disabled** for tile endpoints. MVT tiles cannot be gzip-compressed or OpenLayers will fail to parse them ("Unimplemented type: 7" error). Both the external location and internal `@martin_*` locations need `gzip off`.
- Martin is exposed on port **3030** (mapped from internal 3000) for direct debugging.
- The viewer at `/viewer/` (OpenLayers) includes login and tile preview functionality.
- Simple viewer: `viewer-deckgl/` is a React + deck.gl app for basic tile visualization (port 5173).
- Full editor: `viewer-editor/` is a complete GIS editor with drawing, editing, and layer management tools (port 5174).
- Both viewers can run simultaneously on different ports for side-by-side comparison.

## Production Deployment Checklist

When deploying to production (HTTPS), these dev workarounds must be changed:

1. **Remove cookie rewriting** - The `header_filter_by_lua_block` that removes `Secure` and changes `SameSite=none` to `Lax` is only for HTTP localhost.
2. **Restrict CORS origins** - Change from reflecting any `Origin` to a whitelist of allowed domains.
3. **Keep gzip off for tiles** - This must remain disabled even in production.
4. **Implement token refresh** - Access tokens have 2-minute TTL; implement auto-refresh using the 7-day refresh token.

See `doc/TROUBLESHOOTING_TILES_AUTH.md` for detailed CORS/cookie debugging.

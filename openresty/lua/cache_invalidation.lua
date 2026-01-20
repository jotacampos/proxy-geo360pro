-- cache_invalidation.lua - Invalidação espacial precisa de cache
-- Resolve race condition sem delay, verificando se tile estava em trânsito durante purge

local _M = {}

local cjson = require("cjson")

-- Tempo máximo que uma invalidação fica ativa (segundos)
-- Requests normalmente completam em < 1s, usamos 10s por segurança
local INVALIDATION_TTL = 10

-- Limite de keys para buscar no shared dict
local MAX_KEYS = 1000

-- ============================================
-- Conversão de tile para bbox
-- ============================================

-- Converte tile x/y/z para bounding box (lon/lat)
function _M.tile_to_bbox(z, x, y)
    local n = 2 ^ z

    -- Longitude
    local min_lon = x / n * 360 - 180
    local max_lon = (x + 1) / n * 360 - 180

    -- Latitude (projeção Mercator invertida)
    local function tile_to_lat(y, n)
        local lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
        return math.deg(lat_rad)
    end

    local max_lat = tile_to_lat(y, n)
    local min_lat = tile_to_lat(y + 1, n)

    return {
        min_lon = min_lon,
        min_lat = min_lat,
        max_lon = max_lon,
        max_lat = max_lat
    }
end

-- ============================================
-- Verificação de interseção de bboxes
-- ============================================

-- Verifica se dois bboxes se intersectam
function _M.intersects(bbox1, bbox2)
    -- Não intersecta se um está completamente fora do outro
    if bbox1.max_lon < bbox2.min_lon or bbox1.min_lon > bbox2.max_lon then
        return false
    end
    if bbox1.max_lat < bbox2.min_lat or bbox1.min_lat > bbox2.max_lat then
        return false
    end
    return true
end

-- ============================================
-- Gerenciamento de invalidações (tiles estáticas)
-- ============================================

-- Registra uma invalidação espacial para tiles estáticas
function _M.register_invalidation(municipio, layer, bbox)
    local dict = ngx.shared.spatial_invalidations
    if not dict then
        ngx.log(ngx.WARN, "spatial_invalidations shared dict not configured")
        return false
    end

    local now = ngx.now()
    local key = string.format("%s:%s:%f", municipio, layer, now)

    local data = cjson.encode({
        bbox = bbox,
        time = now
    })

    local ok, err = dict:set(key, data, INVALIDATION_TTL)
    if not ok then
        ngx.log(ngx.ERR, "failed to register invalidation: ", err)
        return false
    end

    ngx.log(ngx.INFO, "registered spatial invalidation: ", key)
    return true
end

-- Obtém invalidações recentes para uma camada
function _M.get_recent_invalidations(municipio, layer)
    local dict = ngx.shared.spatial_invalidations
    if not dict then
        return {}
    end

    local prefix = municipio .. ":" .. layer .. ":"
    local keys = dict:get_keys(MAX_KEYS)
    local invalidations = {}

    for _, key in ipairs(keys) do
        if key:sub(1, #prefix) == prefix then
            local data = dict:get(key)
            if data then
                local ok, inv = pcall(cjson.decode, data)
                if ok then
                    table.insert(invalidations, inv)
                end
            end
        end
    end

    return invalidations
end

-- Verifica se uma tile estática deve ser cacheada
function _M.should_cache(municipio, layer, z, x, y, request_start)
    local invalidations = _M.get_recent_invalidations(municipio, layer)

    if #invalidations == 0 then
        return true  -- sem invalidações, pode cachear
    end

    local tile_bbox = nil  -- Lazy: só calcula se precisar

    for _, inv in ipairs(invalidations) do
        -- Verifica tempo primeiro (mais barato)
        if request_start < inv.time then
            -- Só calcula tile_bbox se passou na verificação de tempo
            if not tile_bbox then
                tile_bbox = _M.tile_to_bbox(z, x, y)
            end
            -- Se a tile intersecta o bbox da invalidação
            -- Então NÃO deve cachear (request estava em trânsito)
            if _M.intersects(tile_bbox, inv.bbox) then
                ngx.log(ngx.INFO, string.format(
                    "skipping cache for tile %d/%d/%d - request in transit during invalidation",
                    z, x, y
                ))
                return false
            end
        end
    end

    return true
end

-- ============================================
-- Funções para tiles dinâmicas
-- ============================================

-- Registra invalidação para tiles dinâmicas
function _M.register_dynamic_invalidation(schema, tbl, fields, bbox)
    local dict = ngx.shared.spatial_invalidations
    if not dict then
        ngx.log(ngx.WARN, "spatial_invalidations shared dict not configured")
        return false
    end

    local now = ngx.now()
    local key = string.format("dynamic:%s:%s:%s:%f", schema, tbl, fields or "*", now)

    local data = cjson.encode({
        bbox = bbox,
        time = now
    })

    local ok, err = dict:set(key, data, INVALIDATION_TTL)
    if not ok then
        ngx.log(ngx.ERR, "failed to register dynamic invalidation: ", err)
        return false
    end

    ngx.log(ngx.INFO, "registered dynamic spatial invalidation: ", key)
    return true
end

-- Verifica se tile dinâmica deve ser cacheada
function _M.should_cache_dynamic(schema, tbl, fields, z, x, y, request_start)
    local dict = ngx.shared.spatial_invalidations
    if not dict then
        return true
    end

    local keys = dict:get_keys(MAX_KEYS)
    if #keys == 0 then
        return true  -- Sem invalidações, pode cachear
    end

    -- Prefixos a verificar (específico e wildcard)
    local prefix_specific = string.format("dynamic:%s:%s:%s:", schema, tbl, fields or "*")
    local prefix_wildcard = string.format("dynamic:%s:%s:*:", schema, tbl)
    local tile_bbox = nil  -- Lazy: só calcula se precisar

    for _, key in ipairs(keys) do
        -- Verifica se a key é relevante
        local is_relevant = key:sub(1, #prefix_specific) == prefix_specific
        if not is_relevant and fields then
            is_relevant = key:sub(1, #prefix_wildcard) == prefix_wildcard
        end

        if is_relevant then
            local data = dict:get(key)
            if data then
                local ok, inv = pcall(cjson.decode, data)
                if ok and request_start < inv.time then
                    -- Só calcula tile_bbox se passou na verificação de tempo
                    if not tile_bbox then
                        tile_bbox = _M.tile_to_bbox(z, x, y)
                    end
                    if _M.intersects(tile_bbox, inv.bbox) then
                        ngx.log(ngx.INFO, string.format(
                            "skipping cache for dynamic tile %d/%d/%d - request in transit during invalidation",
                            z, x, y
                        ))
                        return false
                    end
                end
            end
        end
    end

    return true
end

-- ============================================
-- Estatísticas
-- ============================================

function _M.stats()
    local dict = ngx.shared.spatial_invalidations
    if not dict then
        return { error = "shared dict not configured" }
    end

    local keys = dict:get_keys(0)

    -- Conta por tipo
    local static_count = 0
    local dynamic_count = 0
    for _, key in ipairs(keys) do
        if key:sub(1, 8) == "dynamic:" then
            dynamic_count = dynamic_count + 1
        else
            static_count = static_count + 1
        end
    end

    return {
        active_invalidations = #keys,
        static_invalidations = static_count,
        dynamic_invalidations = dynamic_count,
        ttl = INVALIDATION_TTL
    }
end

return _M

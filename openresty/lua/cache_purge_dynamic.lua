-- cache_purge_dynamic.lua - Invalidação de cache para tiles dinâmicas
-- Suporta: tabela, schema ou bbox

local _M = {}

local CACHE_PATH = "/tmp/tiles_cache"
local cache_inv = require("cache_invalidation")

-- ============================================
-- Validação de input
-- ============================================

-- Valida nome de schema (apenas letras, números, underscore)
local function validate_schema(schema)
    if not schema or schema == "" then
        return "cadastro"  -- default
    end
    if not schema:match("^[%w_]+$") then
        return nil, "schema contém caracteres inválidos"
    end
    if #schema > 50 then
        return nil, "schema muito longo"
    end
    return schema
end

-- Valida nome de tabela
local function validate_table(tbl)
    if not tbl or tbl == "" then
        return nil, "table não pode ser vazio"
    end
    if not tbl:match("^[%w_]+$") then
        return nil, "table contém caracteres inválidos"
    end
    if #tbl > 100 then
        return nil, "table muito longo"
    end
    return tbl
end

-- Valida lista de campos
local function validate_fields(fields)
    if not fields or fields == "" then
        return nil  -- sem filtro específico de campos
    end
    for field in fields:gmatch("[^,]+") do
        field = field:match("^%s*(.-)%s*$")  -- trim
        if not field:match("^[%w_]+$") then
            return nil, "campo '" .. field .. "' contém caracteres inválidos"
        end
    end
    return fields
end

-- Valida bbox
local function validate_bbox(bbox)
    if not bbox then
        return nil, "bbox não pode ser nulo"
    end

    local min_lon = tonumber(bbox.min_lon)
    local min_lat = tonumber(bbox.min_lat)
    local max_lon = tonumber(bbox.max_lon)
    local max_lat = tonumber(bbox.max_lat)

    if not min_lon or not min_lat or not max_lon or not max_lat then
        return nil, "bbox deve ter min_lon, min_lat, max_lon, max_lat"
    end

    if min_lon < -180 or min_lon > 180 or max_lon < -180 or max_lon > 180 then
        return nil, "longitude deve estar entre -180 e 180"
    end

    if min_lat < -90 or min_lat > 90 or max_lat < -90 or max_lat > 90 then
        return nil, "latitude deve estar entre -90 e 90"
    end

    if min_lon >= max_lon then
        return nil, "min_lon deve ser menor que max_lon"
    end

    if min_lat >= max_lat then
        return nil, "min_lat deve ser menor que max_lat"
    end

    return {
        min_lon = min_lon,
        min_lat = min_lat,
        max_lon = max_lon,
        max_lat = max_lat
    }
end

-- ============================================
-- Conversão de coordenadas
-- ============================================

-- Converte lat/lon para tile x/y em um dado zoom
function _M.lat_lon_to_tile(lat, lon, zoom)
    local n = 2 ^ zoom
    local x = math.floor((lon + 180) / 360 * n)
    local lat_rad = math.rad(lat)
    local y = math.floor((1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n)
    return x, y
end

-- Calcula tiles afetados por um bbox em múltiplos níveis de zoom
function _M.bbox_to_tiles(bbox, min_zoom, max_zoom)
    local tiles = {}

    for z = min_zoom, max_zoom do
        local x1, y1 = _M.lat_lon_to_tile(bbox.max_lat, bbox.min_lon, z)
        local x2, y2 = _M.lat_lon_to_tile(bbox.min_lat, bbox.max_lon, z)

        -- Garante ordem correta
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

-- ============================================
-- Funções de purge
-- ============================================

-- Purge usando grep no conteúdo dos arquivos de cache
local function purge_by_pattern(pattern)
    local find_cmd = string.format(
        "grep -r -l 'KEY: %s' %s 2>/dev/null",
        pattern, CACHE_PATH
    )

    local handle = io.popen(find_cmd)
    if not handle then
        return false, 0
    end

    local files = handle:read("*a")
    handle:close()

    if files == "" then
        return true, 0
    end

    -- Deleta cada arquivo encontrado
    local count = 0
    for file in files:gmatch("[^\n]+") do
        os.remove(file)
        count = count + 1
    end

    return true, count
end

-- Purge assíncrono: executa em background e retorna imediatamente
local function purge_by_pattern_async(pattern)
    local ok, err = ngx.timer.at(0, function(premature)
        if premature then return end
        purge_by_pattern(pattern)
    end)
    if not ok then
        ngx.log(ngx.ERR, "failed to create async purge timer: ", err)
        return false
    end
    return true
end

-- ============================================
-- Funções públicas de purge para tiles dinâmicas
-- ============================================

-- Purge por tabela (todas as permutações de fields)
function _M.purge_table(schema, tbl)
    local valid_schema, err1 = validate_schema(schema)
    if err1 then
        return false, err1
    end

    local valid_table, err2 = validate_table(tbl)
    if not valid_table then
        return false, err2
    end

    -- Registra invalidação espacial com bbox mundial
    local world_bbox = { min_lon = -180, min_lat = -90, max_lon = 180, max_lat = 90 }
    cache_inv.register_dynamic_invalidation(valid_schema, valid_table, nil, world_bbox)

    -- Purge assíncrono
    local pattern = string.format("dynamic:%s:%s:", valid_schema, valid_table)
    purge_by_pattern_async(pattern)

    return true, "purge scheduled (async)"
end

-- Purge por bbox (invalida tiles afetados pela geometria editada)
function _M.purge_bbox(schema, tbl, fields, bbox, min_zoom, max_zoom)
    local valid_schema, err1 = validate_schema(schema)
    if err1 then
        return false, { error = err1 }
    end

    local valid_table, err2 = validate_table(tbl)
    if not valid_table then
        return false, { error = err2 }
    end

    local valid_fields, err3 = validate_fields(fields)
    if err3 then
        return false, { error = err3 }
    end

    local valid_bbox, err4 = validate_bbox(bbox)
    if not valid_bbox then
        return false, { error = err4 }
    end

    -- Limita zoom para evitar processamento excessivo
    min_zoom = math.max(tonumber(min_zoom) or 12, 0)
    max_zoom = math.min(tonumber(max_zoom) or 18, 23)

    if min_zoom > max_zoom then
        return false, { error = "min_zoom deve ser menor ou igual a max_zoom" }
    end

    local tiles = _M.bbox_to_tiles(valid_bbox, min_zoom, max_zoom)

    -- Limita número de tiles para evitar DoS
    if #tiles > 50000 then
        return false, { error = "bbox muito grande, limite de 50000 tiles" }
    end

    -- 1. Registra invalidação espacial (previne re-cache de requests em trânsito)
    cache_inv.register_dynamic_invalidation(valid_schema, valid_table, valid_fields, valid_bbox)

    -- 2. Purge otimizado: busca arquivos da tabela e filtra por tiles do bbox
    local tile_set = {}
    for _, tile in ipairs(tiles) do
        -- Cria keys para todas as possíveis combinações de fields
        local base_key = string.format("dynamic:%s:%s:", valid_schema, valid_table)
        tile_set[string.format("%s%d:%d:%d", base_key, tile.z, tile.x, tile.y)] = true
    end

    -- Busca todos arquivos da tabela (um único grep)
    local pattern = string.format("dynamic:%s:%s:", valid_schema, valid_table)
    local find_cmd = string.format(
        "grep -r -l 'KEY: %s' %s 2>/dev/null",
        pattern, CACHE_PATH
    )

    -- Executa purge em background
    ngx.timer.at(0, function(premature)
        if premature then return end

        local handle = io.popen(find_cmd)
        if not handle then return end

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
                        -- Extrai z:x:y da cache key
                        local z, x, y = cache_key:match(":(%d+):(%d+):(%d+)$")
                        if z then
                            z, x, y = tonumber(z), tonumber(x), tonumber(y)
                            if z >= min_zoom and z <= max_zoom then
                                -- Verifica se está no bbox
                                for _, tile in ipairs(tiles) do
                                    if tile.z == z and tile.x == x and tile.y == y then
                                        -- Verifica filtro de fields se especificado
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
    end)

    return true, {
        message = "purge scheduled (async)",
        total_tiles = #tiles,
        spatial_invalidation = true
    }
end

-- ============================================
-- Estatísticas do cache de tiles dinâmicas
-- ============================================
function _M.stats()
    local size = "0"
    local files = 0
    local dynamic_files = 0

    local size_handle = io.popen(string.format("du -sh %s 2>/dev/null | cut -f1", CACHE_PATH))
    if size_handle then
        size = size_handle:read("*l") or "0"
        size_handle:close()
    end

    local count_handle = io.popen(string.format("find %s -type f 2>/dev/null | wc -l", CACHE_PATH))
    if count_handle then
        files = tonumber(count_handle:read("*l")) or 0
        count_handle:close()
    end

    -- Conta apenas tiles dinâmicas
    local dynamic_handle = io.popen(string.format(
        "grep -r -l 'KEY: dynamic:' %s 2>/dev/null | wc -l", CACHE_PATH
    ))
    if dynamic_handle then
        dynamic_files = tonumber(dynamic_handle:read("*l")) or 0
        dynamic_handle:close()
    end

    return {
        total_size = size,
        total_files = files,
        dynamic_files = dynamic_files,
        path = CACHE_PATH
    }
end

return _M

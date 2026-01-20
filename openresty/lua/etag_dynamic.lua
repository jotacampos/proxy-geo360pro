-- etag_dynamic.lua - ETag para tiles dinâmicas usando subrequest
local _M = {}

-- Extrai path e args de uma URI
local function parse_uri(uri)
    local path, args = uri:match("^([^?]+)%??(.*)$")
    return path or uri, args ~= "" and args or nil
end

-- Busca tile via subrequest com suporte a ETag
-- args_string: string com parâmetros para passar ao location interno
function _M.fetch_with_etag(internal_uri, args_string)
    local path, _ = parse_uri(internal_uri)

    -- Faz subrequest para location interno
    local res = ngx.location.capture(path, {
        method = ngx.HTTP_GET,
        args = args_string,
        always_forward_body = false
    })

    -- Tile vazia (204)
    if res.status == 204 then
        ngx.status = 204
        ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
        ngx.header["Cache-Control"] = "public, no-cache"
        return
    end

    -- Erro do upstream
    if res.status >= 400 then
        ngx.status = res.status
        ngx.header["Content-Type"] = "application/json"
        if res.body then
            ngx.print(res.body)
        end
        return
    end

    local body = res.body

    -- Sem body = tile vazia
    if not body or #body == 0 then
        ngx.status = 204
        ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
        ngx.header["Cache-Control"] = "public, no-cache"
        return
    end

    -- Calcula ETag do body
    local etag = '"' .. ngx.md5(body) .. '"'

    -- Verifica If-None-Match
    local if_none_match = ngx.var.http_if_none_match
    if if_none_match and if_none_match == etag then
        -- Match! Retorna 304 sem body
        ngx.status = 304
        ngx.header["ETag"] = etag
        ngx.header["Cache-Control"] = "public, no-cache"
        return
    end

    -- Envia resposta completa com ETag
    ngx.status = 200
    ngx.header["Content-Type"] = "application/vnd.mapbox-vector-tile"
    ngx.header["Content-Length"] = #body
    ngx.header["ETag"] = etag
    ngx.header["Cache-Control"] = "public, no-cache"

    -- Envia body exatamente como recebido
    ngx.print(body)
end

-- Bypass: busca sem ETag (para ?fresh=1 e ?nocache=1)
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
        if res.body then
            ngx.print(res.body)
        end
    end
end

return _M

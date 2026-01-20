-- CORS Module
local _M = {}

function _M.set_headers()
    -- Evita duplicar se já foi setado (ex: OPTIONS preflight)
    if not ngx.header["Access-Control-Allow-Origin"] then
        -- Para suportar credentials: 'include', precisamos refletir o origin
        -- (não podemos usar "*" com credentials)
        local origin = ngx.req.get_headers()["Origin"]
        if origin then
            ngx.header["Access-Control-Allow-Origin"] = origin
        else
            ngx.header["Access-Control-Allow-Origin"] = "*"
        end
    end

    -- Importante para requests com credentials
    if not ngx.header["Access-Control-Allow-Credentials"] then
        ngx.header["Access-Control-Allow-Credentials"] = "true"
    end

    if not ngx.header["Access-Control-Allow-Methods"] then
        ngx.header["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    end
    if not ngx.header["Access-Control-Allow-Headers"] then
        ngx.header["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept, x-auth-token, x-tn-token, Authorization, x-origin, ngrok-skip-browser-warning, Prefer, X-Organization"
    end
    if not ngx.header["Access-Control-Expose-Headers"] then
        ngx.header["Access-Control-Expose-Headers"] = "X-Cache-Status, X-Cache-TTL, X-Cache-Layer, X-Target-URL, Content-Range"
    end
end

return _M

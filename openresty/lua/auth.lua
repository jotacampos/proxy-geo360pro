-- =============================================================================
-- auth.lua - Módulo de autenticação JWT para OpenResty
-- =============================================================================
-- Valida tokens JWT via subrequest ao backend antes de permitir acesso
-- Cacheia resultados para evitar chamadas repetidas ao backend
-- =============================================================================

local _M = {}

local cjson = require("cjson")

-- =============================================================================
-- Configurações
-- =============================================================================

local CACHE_TTL_DEFAULT = 30  -- fallback se não conseguir extrair exp do token
local CACHE_TTL_MIN = 5       -- mínimo de cache (evita muitas chamadas perto da expiração)
local CACHE_DICT_NAME = "jwt_cache"

-- Rotas públicas que não requerem autenticação
local PUBLIC_PATHS = {
    ["/health"] = true,
}

-- Prefixos de rotas públicas
local PUBLIC_PREFIXES = {
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/logout",
}

-- Rotas que invalidam o cache do token quando retornam sucesso
-- (logout, troca de senha, revogação de sessão, etc.)
local INVALIDATION_ROUTES = {
    "/api/auth/logout",
    "/api/auth/change-password",
    "/api/auth/reset-password",
    "/api/user/change-password",
    "/api/user/password",
    "/api/session/revoke",
}

-- =============================================================================
-- Funções auxiliares
-- =============================================================================

-- Decodifica base64url (usado em JWT)
local function base64url_decode(input)
    -- Substitui caracteres base64url por base64 padrão
    local b64 = input:gsub("-", "+"):gsub("_", "/")

    -- Adiciona padding se necessário
    local padding = #b64 % 4
    if padding > 0 then
        b64 = b64 .. string.rep("=", 4 - padding)
    end

    return ngx.decode_base64(b64)
end

-- Extrai o campo 'exp' (expiração) do JWT
local function get_token_expiry(token)
    -- JWT formato: header.payload.signature
    local parts = {}
    for part in token:gmatch("[^.]+") do
        table.insert(parts, part)
    end

    if #parts ~= 3 then
        return nil
    end

    -- Decodifica o payload (segunda parte)
    local payload_b64 = parts[2]
    local payload_json = base64url_decode(payload_b64)

    if not payload_json then
        return nil
    end

    local ok, payload = pcall(cjson.decode, payload_json)
    if not ok or not payload.exp then
        return nil
    end

    return payload.exp
end

-- Calcula TTL baseado na expiração do token
local function calculate_cache_ttl(token)
    local exp = get_token_expiry(token)

    if not exp then
        ngx.log(ngx.DEBUG, "auth: could not extract exp from token, using default TTL")
        return CACHE_TTL_DEFAULT
    end

    local now = ngx.time()
    local ttl = exp - now

    -- Se token já expirou ou está prestes a expirar
    if ttl <= 0 then
        return 0  -- não cacheia
    end

    -- Garante um mínimo de cache
    if ttl < CACHE_TTL_MIN then
        return CACHE_TTL_MIN
    end

    ngx.log(ngx.DEBUG, "auth: token expires in ", ttl, "s, using as cache TTL")
    return ttl
end

-- Verifica se o path é público (não requer auth)
function _M.is_public_path(path)
    -- Verifica paths exatos
    if PUBLIC_PATHS[path] then
        return true
    end

    -- Verifica prefixos
    for _, prefix in ipairs(PUBLIC_PREFIXES) do
        if path:sub(1, #prefix) == prefix then
            return true
        end
    end

    return false
end

-- Extrai token do cookie ou header Authorization
function _M.get_token()
    -- Primeiro tenta o cookie jwt-access-cookie
    local cookie_header = ngx.var.http_cookie
    if cookie_header then
        local token = cookie_header:match("jwt%-access%-cookie=([^;]+)")
        if token then
            return token, "cookie"
        end
    end

    -- Fallback: Header Authorization: Bearer xxx
    local auth_header = ngx.var.http_authorization
    if auth_header then
        local token = auth_header:match("Bearer%s+(.+)")
        if token then
            return token, "header"
        end
    end

    return nil, nil
end

-- Gera chave de cache a partir do token
local function get_cache_key(token)
    return "jwt:" .. ngx.md5(token)
end

-- Retorna resposta de erro JSON com CORS headers
local function error_response(status, message)
    ngx.status = status
    ngx.header["Content-Type"] = "application/json"

    -- IMPORTANTE: Adiciona CORS headers para que o browser não bloqueie a resposta
    local origin = ngx.req.get_headers()["Origin"]
    if origin then
        ngx.header["Access-Control-Allow-Origin"] = origin
    else
        ngx.header["Access-Control-Allow-Origin"] = "*"
    end
    ngx.header["Access-Control-Allow-Credentials"] = "true"

    ngx.say(cjson.encode({
        error = true,
        status = status,
        message = message
    }))
    return ngx.exit(status)
end

-- =============================================================================
-- Validação de token
-- =============================================================================

-- Valida token via subrequest ao backend
function _M.validate_token(token)
    local cache = ngx.shared[CACHE_DICT_NAME]
    local cache_key = get_cache_key(token)

    -- 1. Verifica cache
    if cache then
        local cached = cache:get(cache_key)
        if cached then
            local ok, data = pcall(cjson.decode, cached)
            if ok then
                ngx.log(ngx.DEBUG, "auth: token validation from cache")
                return data.valid, data.user_info
            end
        end
    end

    -- 2. Faz subrequest para validar
    ngx.log(ngx.DEBUG, "auth: validating token via backend")

    local res = ngx.location.capture("/@auth_me", {
        method = ngx.HTTP_GET,
        always_forward_body = false,
        vars = {},
        ctx = { _auth_token = token }
    })

    -- 3. Processa resposta
    local valid = false
    local user_info = nil

    if res.status == 200 and res.body then
        local ok, body = pcall(cjson.decode, res.body)
        if ok and body.content then
            valid = true
            user_info = body.content
        end
    end

    -- 4. Cacheia resultado (usando TTL baseado na expiração do token)
    if cache then
        local ttl = calculate_cache_ttl(token)

        -- Só cacheia se TTL > 0 (token não expirado)
        if ttl > 0 then
            local cache_data = cjson.encode({
                valid = valid,
                user_info = user_info
            })
            local ok, err = cache:set(cache_key, cache_data, ttl)
            if not ok then
                ngx.log(ngx.WARN, "auth: failed to cache validation: ", err)
            else
                ngx.log(ngx.DEBUG, "auth: cached token validation for ", ttl, "s")
            end
        end
    end

    return valid, user_info
end

-- =============================================================================
-- Função principal de autenticação
-- =============================================================================

-- Função chamada em access_by_lua_block
-- Retorna 401 se não autenticado
function _M.require_auth()
    local path = ngx.var.uri

    -- 1. Verifica se é rota pública
    if _M.is_public_path(path) then
        ngx.log(ngx.DEBUG, "auth: public path, skipping auth: ", path)
        return true
    end

    -- 2. Extrai token
    local token, source = _M.get_token()

    if not token then
        ngx.log(ngx.INFO, "auth: no token found for path: ", path)
        return error_response(401, "Token ausente")
    end

    -- 3. Valida token
    local valid, user_info = _M.validate_token(token)

    if not valid then
        ngx.log(ngx.INFO, "auth: invalid token for path: ", path)
        return error_response(401, "Token inválido ou expirado")
    end

    -- 4. Armazena info do usuário no contexto da request
    ngx.ctx.user = user_info
    ngx.ctx.user_id = user_info and user_info.id
    ngx.ctx.authenticated = true

    ngx.log(ngx.DEBUG, "auth: authenticated user_id=", ngx.ctx.user_id, " path=", path)

    return true
end

-- =============================================================================
-- Função para verificar X-Organization (apenas para rotas /api/*)
-- =============================================================================

function _M.require_organization()
    local path = ngx.var.uri

    -- Só verifica para rotas /api/* (exceto /api/auth/*)
    if not path:match("^/api/") or path:match("^/api/auth/") then
        return true
    end

    local org_header = ngx.var.http_x_organization

    if not org_header or org_header == "" then
        ngx.log(ngx.INFO, "auth: missing X-Organization header for path: ", path)
        return error_response(400, "Header X-Organization é obrigatório")
    end

    -- Valida formato UUID
    if not org_header:match("^%x%x%x%x%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%-%x%x%x%x%x%x%x%x%x%x%x%x$") then
        return error_response(400, "X-Organization deve ser um UUID válido")
    end

    ngx.ctx.organization_id = org_header

    return true
end

-- =============================================================================
-- Função combinada: auth + organization
-- =============================================================================

function _M.require_auth_and_org()
    local ok = _M.require_auth()
    if not ok then return false end

    return _M.require_organization()
end

-- =============================================================================
-- Estatísticas do cache
-- =============================================================================

function _M.cache_stats()
    local cache = ngx.shared[CACHE_DICT_NAME]
    if not cache then
        return { error = "cache not configured" }
    end

    local capacity = "unknown"
    if cache.capacity then
        capacity = cache:capacity()
    end

    local keys = cache:get_keys(100)  -- Limita a 100 chaves
    local key_count = #keys

    return {
        dict_name = CACHE_DICT_NAME,
        key_count = key_count,
        keys = keys,
        free_space = cache:free_space(),
        capacity = capacity
    }
end

-- =============================================================================
-- Invalidação de cache por ação do usuário
-- =============================================================================

-- Verifica se o path é uma rota que deve invalidar o cache
local function is_invalidation_route(path)
    for _, route in ipairs(INVALIDATION_ROUTES) do
        if path:sub(1, #route) == route then
            return true
        end
    end
    return false
end

-- Invalida o cache de um token específico
function _M.invalidate_token(token)
    if not token then
        return false, "token não fornecido"
    end

    local cache = ngx.shared[CACHE_DICT_NAME]
    if not cache then
        return false, "cache não configurado"
    end

    local cache_key = get_cache_key(token)
    cache:delete(cache_key)

    ngx.log(ngx.INFO, "auth: token cache invalidated")
    return true
end

-- Função para ser chamada em log_by_lua_block
-- Invalida o cache se a rota for de invalidação e o backend retornou sucesso
function _M.check_and_invalidate()
    local path = ngx.var.uri
    local status = ngx.status

    -- Só processa se for rota de invalidação
    if not is_invalidation_route(path) then
        return
    end

    -- Só invalida se o backend retornou sucesso (2xx)
    if status < 200 or status >= 300 then
        ngx.log(ngx.DEBUG, "auth: invalidation route returned ", status, ", not invalidating cache")
        return
    end

    -- Pega o token que foi usado na request (salvo no contexto)
    local token = ngx.ctx._current_token
    if not token then
        -- Tenta extrair novamente
        token = _M.get_token()
    end

    if token then
        local ok, err = _M.invalidate_token(token)
        if ok then
            ngx.log(ngx.INFO, "auth: cache invalidated after ", path)
        else
            ngx.log(ngx.WARN, "auth: failed to invalidate cache: ", err)
        end
    end
end

-- Marca que esta request deve verificar invalidação
-- Chamada em access_by_lua para salvar o token no contexto
function _M.mark_for_invalidation_check()
    local path = ngx.var.uri

    if is_invalidation_route(path) then
        local token = _M.get_token()
        if token then
            ngx.ctx._current_token = token
            ngx.ctx._check_invalidation = true
        end
    end
end

return _M

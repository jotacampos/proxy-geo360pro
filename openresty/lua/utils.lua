-- utils.lua - Funções auxiliares

local _M = {}

-- ============================================
-- Base64 Decode
-- ============================================
function _M.decode_base64(str)
    if not str then
        return nil
    end
    local ok, decoded = pcall(ngx.decode_base64, str)
    if ok and decoded then
        return decoded
    end
    return nil
end

-- ============================================
-- Decode Tenant ID (base64 -> number)
-- ============================================
function _M.decode_tenant(tn_token)
    if not tn_token or tn_token == "" then
        return nil
    end

    local decoded = _M.decode_base64(tn_token)
    if decoded then
        local num = tonumber(decoded)
        return num
    end

    return nil
end

-- ============================================
-- Parse JSON seguro
-- ============================================
function _M.parse_json(str)
    local cjson = require "cjson.safe"
    if not str or str == "" then
        return nil
    end
    return cjson.decode(str)
end

-- ============================================
-- Encode JSON
-- ============================================
function _M.encode_json(obj)
    local cjson = require "cjson.safe"
    if not obj then
        return "{}"
    end
    return cjson.encode(obj)
end

-- ============================================
-- Log de erro formatado
-- ============================================
function _M.log_error(msg, details)
    local log_msg = msg
    if details then
        log_msg = log_msg .. " - " .. tostring(details)
    end
    ngx.log(ngx.ERR, "[proxy] ", log_msg)
end

-- ============================================
-- Log de info formatado
-- ============================================
function _M.log_info(msg, details)
    local log_msg = msg
    if details then
        log_msg = log_msg .. " - " .. tostring(details)
    end
    ngx.log(ngx.INFO, "[proxy] ", log_msg)
end

-- ============================================
-- Resposta de erro JSON
-- ============================================
function _M.error_response(status, error_msg, message)
    ngx.status = status
    ngx.header["Content-Type"] = "application/json"
    ngx.say(_M.encode_json({
        error = error_msg,
        message = message or error_msg
    }))
    return ngx.exit(status)
end

return _M

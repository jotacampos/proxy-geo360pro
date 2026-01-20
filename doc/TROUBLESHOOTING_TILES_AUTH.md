# Troubleshooting: Tiles MVT e Autenticação JWT

Este documento relata os problemas encontrados durante o desenvolvimento do viewer de tiles MVT com autenticação via cookies JWT, suas causas raiz e soluções aplicadas.

## Problema Original

O viewer OpenLayers não conseguia renderizar as tiles MVT, apresentando o erro:
```
Unimplemented type: 7
```

## Causas Raiz Identificadas

### 1. Cookies com flag `Secure` em HTTP

**Sintoma:** Requisições `/api/*` retornavam 401 mesmo após login bem-sucedido.

**Causa:** O backend setava cookies com `Secure` flag:
```
Set-Cookie: jwt-access-cookie=...; HttpOnly; SameSite=none; Secure
```

O flag `Secure` faz o browser **ignorar** o cookie em conexões HTTP. Como o ambiente de desenvolvimento usa `http://localhost:8081`, os cookies não eram armazenados.

**Solução (DEV):** Reescrever o header `Set-Cookie` no proxy para remover `Secure`:
```lua
header_filter_by_lua_block {
    local cookies = ngx.header["Set-Cookie"]
    if cookies then
        local function fix_cookie(cookie)
            cookie = cookie:gsub("; Secure", ""):gsub(";Secure", "")
            cookie = cookie:gsub("SameSite=none", "SameSite=Lax")
            return cookie
        end
        -- aplicar fix_cookie...
    end
}
```

### 2. `SameSite=none` sem `Secure`

**Sintoma:** Mesmo removendo `Secure`, os cookies ainda não eram enviados.

**Causa:** Browsers modernos **rejeitam** cookies com `SameSite=none` sem `Secure`. É uma medida de segurança.

**Solução (DEV):** Trocar `SameSite=none` por `SameSite=Lax`:
```lua
cookie = cookie:gsub("SameSite=none", "SameSite=Lax")
```

### 3. CORS com `credentials: 'include'`

**Sintoma:** Requisições falhavam com erro de CORS no browser.

**Causa:** Quando o frontend usa `credentials: 'include'` para enviar cookies, o servidor **não pode** retornar `Access-Control-Allow-Origin: *`. O browser exige a origem específica.

**Solução:** Refletir a origem da requisição:
```nginx
set_by_lua_block $cors_origin {
    return ngx.var.http_origin or "http://localhost:8081"
}
add_header 'Access-Control-Allow-Origin' $cors_origin always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
```

### 4. Tiles comprimidas com Gzip

**Sintoma:** Erro "Unimplemented type: 7" ao parsear tiles como MVT.

**Causa:** O byte `0x1f` (início de gzip) era interpretado como protobuf, causando erro de parsing. O nginx estava comprimindo as respostas mesmo com `gzip off` no location externo.

**Investigação:** O header das tiles era `1f 8b 08 00` (gzip magic bytes) ao invés de `1a xx xx xx` (protobuf/MVT).

**Solução:** Adicionar `gzip off` e `Accept-Encoding: ""` no location **interno** que faz proxy para o Martin:
```nginx
location ~ ^/@martin_dynamic_internal/(\d+)/(\d+)/(\d+)$ {
    internal;
    gzip off;
    # ...
    proxy_set_header Accept-Encoding "";  # Não pedir gzip ao Martin
}
```

### 5. Token JWT com TTL muito curto

**Sintoma:** Tiles funcionavam inicialmente, depois paravam com erro JSON.

**Causa:** O access token tem TTL de apenas **2 minutos**. Após expirar, o proxy retornava JSON de erro:
```json
{"error":true,"status":401,"message":"Token inválido ou expirado"}
```

O viewer tentava parsear esse JSON como MVT, causando erro.

**Solução:** Implementar detecção de erro no viewer:
```javascript
// Detectar se é JSON de erro (começa com '{' = 0x7B)
if (bytes[0] === 0x7B || contentType.includes('application/json')) {
    const text = new TextDecoder().decode(data);
    const json = JSON.parse(text);
    if (json.status === 401) {
        // Token expirado - solicitar re-login
    }
}
```

## Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `openresty/nginx.conf.template` | CORS, cookies, gzip |
| `viewer/index.html` | Detecção de erros, cache buster |
| `martin/config.yml` | CORS, cache desabilitado |

## Configuração Atual (Desenvolvimento)

### nginx.conf.template - Location /api/

```nginx
location /api/ {
    # ... proxy config ...

    # CORS com credentials
    set_by_lua_block $cors_origin {
        return ngx.var.http_origin or "http://localhost:8081"
    }
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # DEV: Ajusta cookies para HTTP localhost
    header_filter_by_lua_block {
        local cookies = ngx.header["Set-Cookie"]
        if cookies then
            local function fix_cookie(cookie)
                cookie = cookie:gsub("; Secure", ""):gsub(";Secure", "")
                cookie = cookie:gsub("SameSite=none", "SameSite=Lax")
                return cookie
            end
            if type(cookies) == "table" then
                for i, cookie in ipairs(cookies) do
                    cookies[i] = fix_cookie(cookie)
                end
            else
                cookies = fix_cookie(cookies)
            end
            ngx.header["Set-Cookie"] = cookies
        end
    }
}
```

### nginx.conf.template - Location interno Martin

```nginx
location ~ ^/@martin_dynamic_internal/(\d+)/(\d+)/(\d+)$ {
    internal;
    gzip off;
    # ...
    proxy_set_header Accept-Encoding "";
}
```

---

## Mudanças Necessárias para Produção

### 1. Remover reescrita de cookies

Em produção com HTTPS, os cookies com `Secure` e `SameSite=none` funcionam normalmente.

**Remover ou condicionar** o bloco `header_filter_by_lua_block` que modifica cookies:

```nginx
# PRODUÇÃO: Remover este bloco inteiro
# header_filter_by_lua_block { ... fix_cookie ... }
```

Ou usar variável de ambiente para condicionar:
```nginx
header_filter_by_lua_block {
    -- Só modifica em dev
    if os.getenv("ENV") == "development" then
        -- fix cookies
    end
}
```

### 2. CORS - Restringir origens

Em produção, não refletir qualquer origem. Usar lista de origens permitidas:

```nginx
# PRODUÇÃO: Lista fixa de origens permitidas
set $cors_origin "";
if ($http_origin ~* "^https://(app\.geo360\.com\.br|viewer\.geo360\.com\.br)$") {
    set $cors_origin $http_origin;
}
add_header 'Access-Control-Allow-Origin' $cors_origin always;
```

Ou configurar via variável de ambiente:
```nginx
set $allowed_origin "${ALLOWED_ORIGIN}";  # ex: https://app.geo360.com.br
```

### 3. Gzip - Manter desabilitado para tiles

A configuração de `gzip off` para tiles **deve ser mantida** em produção. Tiles MVT não devem ser comprimidas pelo nginx pois o OpenLayers não suporta descompressão automática.

```nginx
# PRODUÇÃO: Manter estas configurações
location ~ ^/tiles/dynamic/ {
    gzip off;
    # ...
}

location ~ ^/@martin_dynamic_internal/ {
    gzip off;
    proxy_set_header Accept-Encoding "";
}
```

### 4. Cache de tiles

Em produção, pode-se habilitar cache mais agressivo:

```nginx
proxy_cache_valid 200 7d;   # Tiles válidas por 7 dias
proxy_cache_valid 204 1h;   # Tiles vazias por 1 hora
```

### 5. Refresh automático de token

Implementar refresh automático no viewer usando o refresh token (TTL de 7 dias) para renovar o access token (TTL de 2 minutos) antes de expirar:

```javascript
// A cada 90 segundos, renovar o token
setInterval(async () => {
    await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
    });
}, 90000);
```

---

## Checklist de Deploy para Produção

- [ ] Remover/condicionar reescrita de cookies (Secure, SameSite)
- [ ] Configurar lista de origens CORS permitidas
- [ ] Verificar que HTTPS está configurado corretamente
- [ ] Manter `gzip off` para endpoints de tiles
- [ ] Configurar TTLs de cache apropriados
- [ ] Implementar refresh automático de token no frontend
- [ ] Testar autenticação end-to-end em ambiente staging

---

## Comandos Úteis para Debug

```bash
# Verificar headers de cookie no login
curl -v -X POST "http://localhost:8081/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' 2>&1 | grep -i set-cookie

# Testar tile com cookies
curl -b cookies.txt -w "Status: %{http_code}\n" \
  "http://localhost:8081/tiles/dynamic/11/744/1120.pbf?schema=...&table=...&geom=geom&srid=4326&fields=id"

# Verificar se tile é gzip ou MVT
curl -s -o tile.pbf "URL" && xxd -l 4 tile.pbf
# Gzip: 1f 8b 08 00
# MVT:  1a xx xx xx

# Verificar logs do OpenResty
docker compose logs -f openresty | grep -E "(auth|401|cookie)"

# Limpar cache de tiles
docker compose exec openresty rm -rf /tmp/tiles_cache/*
```

---

## Referências

- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [MDN: CORS with credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#requests_with_credentials)
- [OpenLayers VectorTile](https://openlayers.org/en/latest/apidoc/module-ol_source_VectorTile-VectorTile.html)
- [Mapbox Vector Tile Specification](https://github.com/mapbox/vector-tile-spec)

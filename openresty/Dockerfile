# =============================================================================
# Dockerfile - OpenResty Proxy
# =============================================================================
# Proxy para múltiplos backends (Martin, MinIO, API)
# Configuração via variáveis de ambiente
# =============================================================================

FROM openresty/openresty:1.27.1.1-0-alpine

# Instalar ferramentas necessárias
RUN apk add --no-cache \
    gettext \
    curl \
    grep \
    findutils

# Criar diretórios necessários
RUN mkdir -p /tmp/tiles_cache /tmp/storage_cache \
    && chmod 777 /tmp/tiles_cache /tmp/storage_cache

# Copiar módulos Lua
COPY lua/ /usr/local/openresty/nginx/lua/

# Copiar template de configuração
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Variáveis de ambiente com valores default
ENV MARTIN_URL=http://martin:3000
ENV MINIO_URL=http://minio:9000
ENV BACKEND_URL=http://backend:8080
ENV BACKEND_HOST=backend

# Expor porta
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Entrypoint: substitui variáveis e inicia OpenResty
CMD envsubst '${MARTIN_URL} ${MINIO_URL} ${BACKEND_URL} ${BACKEND_HOST}' \
    < /etc/nginx/nginx.conf.template \
    > /usr/local/openresty/nginx/conf/nginx.conf \
    && openresty -g 'daemon off;'

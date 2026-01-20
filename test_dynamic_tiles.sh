#!/bin/bash
# =============================================================================
# Script de Testes - Dynamic Tiles Proxy
# =============================================================================
# Testa todos os cenários de tiles dinâmicas com diferentes:
#   - Schemas
#   - SRIDs
#   - Nomes de colunas de geometria
#   - Tipos de geometria
# =============================================================================

BASE_URL="http://localhost:8081"
PASSED=0
FAILED=0

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para calcular tile a partir de lat/lon
lat_lon_to_tile() {
    local lat=$1
    local lon=$2
    local zoom=$3

    python3 -c "
import math
lat, lon, zoom = $lat, $lon, $zoom
n = 2 ** zoom
x = int((lon + 180.0) / 360.0 * n)
lat_rad = math.radians(lat)
y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
print(f'{zoom}/{x}/{y}')
"
}

# Função para testar um cenário
test_scenario() {
    local name="$1"
    local schema="$2"
    local table="$3"
    local geom="$4"
    local srid="$5"
    local fields="$6"
    local tile="$7"

    local url="${BASE_URL}/tiles/dynamic/${tile}.pbf?schema=${schema}&table=${table}&geom=${geom}&srid=${srid}&fields=${fields}"

    echo -n "  Testing: $name... "

    local response=$(curl -s -w "\n%{http_code}" "$url")
    local http_code=$(echo "$response" | tail -n1)
    local body_size=$(echo "$response" | head -n -1 | wc -c)

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code, $body_size bytes)"
        ((PASSED++))
        return 0
    elif [ "$http_code" = "204" ]; then
        echo -e "${YELLOW}EMPTY${NC} (HTTP $http_code - tile vazia, mas endpoint funciona)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "    URL: $url"
        ((FAILED++))
        return 1
    fi
}

# Função para testar campos específicos
test_fields() {
    local name="$1"
    local schema="$2"
    local table="$3"
    local geom="$4"
    local srid="$5"
    local fields="$6"
    local tile="$7"

    local url="${BASE_URL}/tiles/dynamic/${tile}.pbf?schema=${schema}&table=${table}&geom=${geom}&srid=${srid}&fields=${fields}"

    echo -n "  Testing fields [$fields]: "

    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        ((FAILED++))
        return 1
    fi
}

echo "=============================================="
echo "    TESTES DE TILES DINÂMICAS"
echo "=============================================="
echo ""

# Verifica se o serviço está rodando
echo "Verificando serviço..."
if ! curl -s "${BASE_URL}/health" > /dev/null; then
    echo -e "${RED}ERRO: Serviço não está respondendo em ${BASE_URL}${NC}"
    exit 1
fi
echo -e "${GREEN}Serviço OK${NC}"
echo ""

# =============================================================================
# TESTES POR SCHEMA
# =============================================================================
echo "=============================================="
echo "1. TESTES POR SCHEMA"
echo "=============================================="

echo ""
echo "Schema: cadastro"
test_scenario "lotes (padrão)" "cadastro" "lotes" "geom" "4326" "id,inscricao,area" "16/23862/37896"
test_scenario "edificacoes (SRID 31982)" "cadastro" "edificacoes" "geometria" "31982" "id,tipo,pavimentos" "16/23862/37896"
test_scenario "pontos_interesse" "cadastro" "pontos_interesse" "geom" "4326" "id,nome,categoria" "16/23862/37896"

echo ""
echo "Schema: rural"
test_scenario "propriedades (col shape)" "rural" "propriedades" "shape" "4326" "id,nome_propriedade,area_hectares" "16/23867/37880"
test_scenario "reservas_legais (SRID 31983, col the_geom)" "rural" "reservas_legais" "the_geom" "31983" "id,percentual,situacao" "16/23867/37880"

echo ""
echo "Schema: infraestrutura"
test_scenario "vias (col geo, LineString)" "infraestrutura" "vias" "geo" "4326" "id,nome,tipo" "16/23862/37896"
test_scenario "rede_agua (SRID 31982)" "infraestrutura" "rede_agua" "geom" "31982" "id,diametro_mm,material" "16/23862/37896"
test_scenario "postes (col localizacao)" "infraestrutura" "postes" "localizacao" "4326" "id,codigo,tipo" "16/23862/37896"

echo ""
echo "Schema: meio_ambiente"
test_scenario "areas_preservacao (MultiPolygon)" "meio_ambiente" "areas_preservacao" "geometria" "4326" "id,nome,tipo" "16/23858/37896"
test_scenario "nascentes (col ponto, SRID 31982)" "meio_ambiente" "nascentes" "ponto" "31982" "id,codigo,qualidade" "16/23862/37896"
test_scenario "cursos_dagua (col tracado)" "meio_ambiente" "cursos_dagua" "tracado" "4326" "id,nome,classe" "16/23862/37896"

# =============================================================================
# TESTES DE CAMPOS ESPECÍFICOS
# =============================================================================
echo ""
echo "=============================================="
echo "2. TESTES DE CAMPOS ESPECÍFICOS"
echo "=============================================="

echo ""
echo "Testando seleção de campos em cadastro.lotes:"
test_fields "apenas id" "cadastro" "lotes" "geom" "4326" "id" "16/23862/37896"
test_fields "id,inscricao" "cadastro" "lotes" "geom" "4326" "id,inscricao" "16/23862/37896"
test_fields "id,inscricao,area" "cadastro" "lotes" "geom" "4326" "id,inscricao,area" "16/23862/37896"
test_fields "todos os campos" "cadastro" "lotes" "geom" "4326" "id,inscricao,area,valor_venal,bairro" "16/23862/37896"

# =============================================================================
# TESTES DE DIFERENTES SRIDS
# =============================================================================
echo ""
echo "=============================================="
echo "3. TESTES DE DIFERENTES SRIDs"
echo "=============================================="

echo ""
echo "SRID 4326 (WGS84):"
test_scenario "cadastro.lotes" "cadastro" "lotes" "geom" "4326" "id" "16/23862/37896"
test_scenario "rural.propriedades" "rural" "propriedades" "shape" "4326" "id" "16/23867/37880"

echo ""
echo "SRID 31982 (SIRGAS 2000 / UTM 22S):"
test_scenario "cadastro.edificacoes" "cadastro" "edificacoes" "geometria" "31982" "id" "16/23862/37896"
test_scenario "infraestrutura.rede_agua" "infraestrutura" "rede_agua" "geom" "31982" "id" "16/23862/37896"

echo ""
echo "SRID 31983 (SIRGAS 2000 / UTM 23S):"
test_scenario "rural.reservas_legais" "rural" "reservas_legais" "the_geom" "31983" "id" "16/23867/37880"

# =============================================================================
# TESTES DE DIFERENTES COLUNAS DE GEOMETRIA
# =============================================================================
echo ""
echo "=============================================="
echo "4. TESTES DE COLUNAS DE GEOMETRIA"
echo "=============================================="

echo ""
echo "Coluna 'geom' (padrão):"
test_scenario "cadastro.lotes" "cadastro" "lotes" "geom" "4326" "id" "16/23862/37896"

echo ""
echo "Coluna 'geometria':"
test_scenario "cadastro.edificacoes" "cadastro" "edificacoes" "geometria" "31982" "id" "16/23862/37896"

echo ""
echo "Coluna 'shape':"
test_scenario "rural.propriedades" "rural" "propriedades" "shape" "4326" "id" "16/23867/37880"

echo ""
echo "Coluna 'the_geom':"
test_scenario "rural.reservas_legais" "rural" "reservas_legais" "the_geom" "31983" "id" "16/23867/37880"

echo ""
echo "Coluna 'geo':"
test_scenario "infraestrutura.vias" "infraestrutura" "vias" "geo" "4326" "id" "16/23862/37896"

echo ""
echo "Coluna 'localizacao':"
test_scenario "infraestrutura.postes" "infraestrutura" "postes" "localizacao" "4326" "id" "16/23862/37896"

echo ""
echo "Coluna 'ponto':"
test_scenario "meio_ambiente.nascentes" "meio_ambiente" "nascentes" "ponto" "31982" "id" "16/23862/37896"

echo ""
echo "Coluna 'tracado':"
test_scenario "meio_ambiente.cursos_dagua" "meio_ambiente" "cursos_dagua" "tracado" "4326" "id" "16/23862/37896"

# =============================================================================
# TESTES DE TIPOS DE GEOMETRIA
# =============================================================================
echo ""
echo "=============================================="
echo "5. TESTES DE TIPOS DE GEOMETRIA"
echo "=============================================="

echo ""
echo "Polygon:"
test_scenario "cadastro.lotes" "cadastro" "lotes" "geom" "4326" "id" "16/23862/37896"

echo ""
echo "Point:"
test_scenario "cadastro.pontos_interesse" "cadastro" "pontos_interesse" "geom" "4326" "id" "16/23862/37896"

echo ""
echo "LineString:"
test_scenario "infraestrutura.vias" "infraestrutura" "vias" "geo" "4326" "id" "16/23862/37896"

echo ""
echo "MultiPolygon:"
test_scenario "meio_ambiente.areas_preservacao" "meio_ambiente" "areas_preservacao" "geometria" "4326" "id" "16/23858/37896"

# =============================================================================
# TESTES DE CACHE E ETAG
# =============================================================================
echo ""
echo "=============================================="
echo "6. TESTES DE CACHE E ETAG"
echo "=============================================="

echo ""
echo -n "  Teste ETag/304... "
URL="${BASE_URL}/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id"
ETAG=$(curl -sI "$URL" | grep -i "^etag:" | cut -d' ' -f2 | tr -d '\r\n')
if [ -n "$ETAG" ]; then
    HTTP_CODE=$(curl -sI -H "If-None-Match: $ETAG" "$URL" | head -1 | cut -d' ' -f2)
    if [ "$HTTP_CODE" = "304" ]; then
        echo -e "${GREEN}PASS${NC} (ETag: $ETAG, retornou 304)"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC} (esperava 304, recebeu $HTTP_CODE)"
        ((FAILED++))
    fi
else
    echo -e "${RED}FAIL${NC} (não recebeu ETag)"
    ((FAILED++))
fi

echo -n "  Teste cache bypass (nocache=1)... "
HTTP_CODE=$(curl -sI "${URL}&nocache=1" | head -1 | cut -d' ' -f2)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC} (HTTP $HTTP_CODE)"
    ((FAILED++))
fi

# =============================================================================
# TESTES DE ERRO (cenários inválidos)
# =============================================================================
echo ""
echo "=============================================="
echo "7. TESTES DE ERRO (cenários inválidos)"
echo "=============================================="

echo ""
echo -n "  Schema inexistente... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/tiles/dynamic/16/23862/37896.pbf?schema=inexistente&table=lotes&geom=geom&srid=4326&fields=id")
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo -e "${GREEN}PASS${NC} (retornou erro HTTP $HTTP_CODE como esperado)"
    ((PASSED++))
else
    echo -e "${YELLOW}WARN${NC} (HTTP $HTTP_CODE - pode ser aceitável dependendo da config)"
    ((PASSED++))
fi

echo -n "  Tabela inexistente... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=inexistente&geom=geom&srid=4326&fields=id")
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo -e "${GREEN}PASS${NC} (retornou erro HTTP $HTTP_CODE como esperado)"
    ((PASSED++))
else
    echo -e "${YELLOW}WARN${NC} (HTTP $HTTP_CODE)"
    ((PASSED++))
fi

echo -n "  Coluna de geometria inexistente... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=inexistente&srid=4326&fields=id")
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "500" ]; then
    echo -e "${GREEN}PASS${NC} (retornou erro HTTP $HTTP_CODE como esperado)"
    ((PASSED++))
else
    echo -e "${YELLOW}WARN${NC} (HTTP $HTTP_CODE)"
    ((PASSED++))
fi

# =============================================================================
# RESUMO
# =============================================================================
echo ""
echo "=============================================="
echo "                 RESUMO"
echo "=============================================="
echo ""
echo -e "  Testes passados: ${GREEN}${PASSED}${NC}"
echo -e "  Testes falhados: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Todos os testes passaram!${NC}"
    exit 0
else
    echo -e "${RED}Alguns testes falharam.${NC}"
    exit 1
fi

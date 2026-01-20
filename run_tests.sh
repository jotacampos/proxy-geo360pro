#!/bin/bash
echo "=============================================="
echo "   TESTES COMPLETOS - TILES DINÂMICAS"
echo "=============================================="

echo ""
echo "1. cadastro.lotes (Polygon, SRID 4326, col: geom)"
echo "   Tile: 16/23862/37896"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao,area,bairro" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao,area,bairro" | grep "Content-Length"

echo ""
echo "2. cadastro.edificacoes (Polygon, SRID 31982, col: geometria)"
echo "   Tile: 16/23876/37901"
curl -sI "http://localhost:8081/tiles/dynamic/16/23876/37901.pbf?schema=cadastro&table=edificacoes&geom=geometria&srid=31982&fields=id,tipo,pavimentos" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23876/37901.pbf?schema=cadastro&table=edificacoes&geom=geometria&srid=31982&fields=id,tipo,pavimentos" | grep "Content-Length"

echo ""
echo "3. cadastro.pontos_interesse (Point, SRID 4326, col: geom)"
echo "   Tile: 16/23862/37896"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=pontos_interesse&geom=geom&srid=4326&fields=id,nome,categoria" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=pontos_interesse&geom=geom&srid=4326&fields=id,nome,categoria" | grep "Content-Length"

echo ""
echo "4. rural.propriedades (Polygon, SRID 4326, col: shape)"
echo "   Tile: 16/23868/37887"
curl -sI "http://localhost:8081/tiles/dynamic/16/23868/37887.pbf?schema=rural&table=propriedades&geom=shape&srid=4326&fields=id,nome_propriedade,area_hectares" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23868/37887.pbf?schema=rural&table=propriedades&geom=shape&srid=4326&fields=id,nome_propriedade,area_hectares" | grep "Content-Length"

echo ""
echo "5. rural.reservas_legais (MultiPolygon, SRID 31983, col: the_geom)"
echo "   Tile: 16/24577/37900"
curl -sI "http://localhost:8081/tiles/dynamic/16/24577/37900.pbf?schema=rural&table=reservas_legais&geom=the_geom&srid=31983&fields=id,percentual,situacao" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/24577/37900.pbf?schema=rural&table=reservas_legais&geom=the_geom&srid=31983&fields=id,percentual,situacao" | grep "Content-Length"

echo ""
echo "6. infraestrutura.vias (LineString, SRID 4326, col: geo)"
echo "   Tile: 16/23862/37896"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=vias&geom=geo&srid=4326&fields=id,nome,tipo" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=vias&geom=geo&srid=4326&fields=id,nome,tipo" | grep "Content-Length"

echo ""
echo "7. infraestrutura.rede_agua (LineString, SRID 31982, col: geom)"
echo "   Tile: 16/23876/37901"
curl -sI "http://localhost:8081/tiles/dynamic/16/23876/37901.pbf?schema=infraestrutura&table=rede_agua&geom=geom&srid=31982&fields=id,diametro_mm,material" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23876/37901.pbf?schema=infraestrutura&table=rede_agua&geom=geom&srid=31982&fields=id,diametro_mm,material" | grep "Content-Length"

echo ""
echo "8. infraestrutura.postes (Point, SRID 4326, col: localizacao)"
echo "   Tile: 16/23862/37896"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=postes&geom=localizacao&srid=4326&fields=id,codigo,tipo" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=postes&geom=localizacao&srid=4326&fields=id,codigo,tipo" | grep "Content-Length"

echo ""
echo "9. meio_ambiente.areas_preservacao (MultiPolygon, SRID 4326, col: geometria)"
echo "   Tile: 16/23859/37894"
curl -sI "http://localhost:8081/tiles/dynamic/16/23859/37894.pbf?schema=meio_ambiente&table=areas_preservacao&geom=geometria&srid=4326&fields=id,nome,tipo" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23859/37894.pbf?schema=meio_ambiente&table=areas_preservacao&geom=geometria&srid=4326&fields=id,nome,tipo" | grep "Content-Length"

echo ""
echo "10. meio_ambiente.nascentes (Point, SRID 31982, col: ponto)"
echo "    Tile: 16/23877/37900"
curl -sI "http://localhost:8081/tiles/dynamic/16/23877/37900.pbf?schema=meio_ambiente&table=nascentes&geom=ponto&srid=31982&fields=id,codigo,qualidade" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23877/37900.pbf?schema=meio_ambiente&table=nascentes&geom=ponto&srid=31982&fields=id,codigo,qualidade" | grep "Content-Length"

echo ""
echo "11. meio_ambiente.cursos_dagua (LineString, SRID 4326, col: tracado)"
echo "    Tile: 16/23862/37893"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37893.pbf?schema=meio_ambiente&table=cursos_dagua&geom=tracado&srid=4326&fields=id,nome,classe" | head -1
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37893.pbf?schema=meio_ambiente&table=cursos_dagua&geom=tracado&srid=4326&fields=id,nome,classe" | grep "Content-Length"

echo ""
echo "=============================================="
echo "   RESUMO DOS TESTES"
echo "=============================================="

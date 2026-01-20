#!/bin/bash
echo "=============================================="
echo "   TESTES DE FILTROS DE ATRIBUTOS"
echo "=============================================="
echo ""
echo "Tabela: cadastro.lotes"
echo "Campos disponíveis: id, inscricao, area, valor_venal, bairro"
echo ""

echo "1. Apenas 'id':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id" | grep "Content-Length"

echo "2. 'id,inscricao':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao" | grep "Content-Length"

echo "3. 'id,inscricao,area':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao,area" | grep "Content-Length"

echo "4. 'id,inscricao,area,bairro':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao,area,bairro" | grep "Content-Length"

echo "5. Todos: 'id,inscricao,area,valor_venal,bairro':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=cadastro&table=lotes&geom=geom&srid=4326&fields=id,inscricao,area,valor_venal,bairro" | grep "Content-Length"

echo ""
echo "=============================================="
echo ""
echo "Tabela: rural.propriedades"
echo "Campos disponíveis: id, nome_propriedade, proprietario, area_hectares, car"
echo ""

echo "1. Apenas 'id':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23868/37887.pbf?schema=rural&table=propriedades&geom=shape&srid=4326&fields=id" | grep "Content-Length"

echo "2. 'id,nome_propriedade':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23868/37887.pbf?schema=rural&table=propriedades&geom=shape&srid=4326&fields=id,nome_propriedade" | grep "Content-Length"

echo "3. 'id,nome_propriedade,proprietario':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23868/37887.pbf?schema=rural&table=propriedades&geom=shape&srid=4326&fields=id,nome_propriedade,proprietario" | grep "Content-Length"

echo "4. Todos: 'id,nome_propriedade,proprietario,area_hectares,car':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23868/37887.pbf?schema=rural&table=propriedades&geom=shape&srid=4326&fields=id,nome_propriedade,proprietario,area_hectares,car" | grep "Content-Length"

echo ""
echo "=============================================="
echo ""
echo "Tabela: infraestrutura.vias"
echo "Campos disponíveis: id, nome, tipo, largura_metros, pavimentacao"
echo ""

echo "1. Apenas 'id':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=vias&geom=geo&srid=4326&fields=id" | grep "Content-Length"

echo "2. 'id,nome':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=vias&geom=geo&srid=4326&fields=id,nome" | grep "Content-Length"

echo "3. 'id,nome,tipo,largura_metros':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=vias&geom=geo&srid=4326&fields=id,nome,tipo,largura_metros" | grep "Content-Length"

echo "4. Todos: 'id,nome,tipo,largura_metros,pavimentacao':"
curl -sI "http://localhost:8081/tiles/dynamic/16/23862/37896.pbf?schema=infraestrutura&table=vias&geom=geo&srid=4326&fields=id,nome,tipo,largura_metros,pavimentacao" | grep "Content-Length"

echo ""
echo "=============================================="
echo "   RESUMO"
echo "=============================================="
echo "Os tamanhos devem aumentar conforme mais campos são solicitados"

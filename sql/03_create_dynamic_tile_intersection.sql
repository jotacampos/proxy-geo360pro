-- =============================================================================
-- Função dinâmica para geração de tiles vetoriais com INTERSEÇÃO de duas camadas
-- =============================================================================
-- Versão com:
--   - Interseção espacial entre duas camadas dinâmicas
--   - Simplificação de geometria adaptativa por zoom
--   - Limite de features por tile (mais restritivo devido ao JOIN)
--   - Ordenação por área (features maiores primeiro)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dynamic_tile_intersection(
    z integer,
    x integer,
    y integer,
    query json DEFAULT '{}'::json
) RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
    -- Layer 1
    v_schema1 text;
    v_table1 text;
    v_geom1 text;
    v_srid1 integer;
    v_fields1 text;           -- campos originais para CTE
    v_fields1_arr text[];
    v_fields1_prefixed text;  -- campos com prefixo l1_ para SELECT final

    -- Layer 2
    v_schema2 text;
    v_table2 text;
    v_geom2 text;
    v_srid2 integer;
    v_fields2 text;           -- campos originais para CTE
    v_fields2_arr text[];
    v_fields2_prefixed text;  -- campos com prefixo l2_ para SELECT final

    -- Output
    v_layer_name text;

    -- Internos
    v_tile_bounds geometry;
    v_feature_limit integer;
    v_simplify_tolerance float8;
    v_result bytea;
    v_field text;
BEGIN
    -- =========================================================================
    -- 1. Validação de zoom mínimo (JOIN espacial é pesado)
    -- =========================================================================
    IF z < 10 THEN
        RAISE EXCEPTION 'Interseção dinâmica requer zoom >= 10 (atual: %)', z;
    END IF;

    -- =========================================================================
    -- 2. Extrai parâmetros da Layer 1
    -- =========================================================================
    v_schema1 := COALESCE(query->>'schema1', 'cadastro');
    v_table1 := query->>'table1';
    v_geom1 := query->>'geom1';
    v_srid1 := (query->>'srid1')::integer;

    IF v_table1 IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "table1" é obrigatório';
    END IF;
    IF v_geom1 IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "geom1" é obrigatório';
    END IF;
    IF v_srid1 IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "srid1" é obrigatório';
    END IF;

    -- =========================================================================
    -- 3. Extrai parâmetros da Layer 2
    -- =========================================================================
    v_schema2 := COALESCE(query->>'schema2', 'cadastro');
    v_table2 := query->>'table2';
    v_geom2 := query->>'geom2';
    v_srid2 := (query->>'srid2')::integer;

    IF v_table2 IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "table2" é obrigatório';
    END IF;
    IF v_geom2 IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "geom2" é obrigatório';
    END IF;
    IF v_srid2 IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "srid2" é obrigatório';
    END IF;

    -- Output config
    v_layer_name := COALESCE(query->>'layer_name', 'intersection');

    -- =========================================================================
    -- 4. Validação: Verifica se tabelas existem
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema1 AND table_name = v_table1
    ) THEN
        RAISE EXCEPTION 'Tabela %.% não existe', v_schema1, v_table1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema2 AND table_name = v_table2
    ) THEN
        RAISE EXCEPTION 'Tabela %.% não existe', v_schema2, v_table2;
    END IF;

    -- =========================================================================
    -- 5. Validação: Verifica se colunas de geometria existem
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema1 AND table_name = v_table1 AND column_name = v_geom1
    ) THEN
        RAISE EXCEPTION 'Coluna % não existe em %.%', v_geom1, v_schema1, v_table1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema2 AND table_name = v_table2 AND column_name = v_geom2
    ) THEN
        RAISE EXCEPTION 'Coluna % não existe em %.%', v_geom2, v_schema2, v_table2;
    END IF;

    -- =========================================================================
    -- 6. Processa campos da Layer 1
    -- =========================================================================
    -- v_fields1: campos para SELECT na CTE (sem prefixo)
    -- v_fields1_prefixed: campos para SELECT final (com prefixo l1_)
    IF query->>'fields1' IS NOT NULL AND query->>'fields1' != '' THEN
        v_fields1_arr := string_to_array(query->>'fields1', ',');
        -- Campos para CTE (originais)
        SELECT string_agg(quote_ident(trim(f)), ', ') INTO v_fields1
        FROM unnest(v_fields1_arr) AS f;
        -- Campos para SELECT final (com prefixo)
        SELECT string_agg(format('l1.%I AS l1_%s', trim(f), trim(f)), ', ') INTO v_fields1_prefixed
        FROM unnest(v_fields1_arr) AS f;
    ELSE
        -- Pega todos os campos não-geométricos
        SELECT string_agg(quote_ident(column_name), ', ') INTO v_fields1
        FROM information_schema.columns
        WHERE table_schema = v_schema1
        AND table_name = v_table1
        AND column_name != v_geom1
        AND udt_name NOT IN ('geometry', 'geography');

        SELECT string_agg(format('l1.%I AS l1_%s', column_name, column_name), ', ') INTO v_fields1_prefixed
        FROM information_schema.columns
        WHERE table_schema = v_schema1
        AND table_name = v_table1
        AND column_name != v_geom1
        AND udt_name NOT IN ('geometry', 'geography');
    END IF;

    -- =========================================================================
    -- 7. Processa campos da Layer 2
    -- =========================================================================
    IF query->>'fields2' IS NOT NULL AND query->>'fields2' != '' THEN
        v_fields2_arr := string_to_array(query->>'fields2', ',');
        -- Campos para CTE (originais)
        SELECT string_agg(quote_ident(trim(f)), ', ') INTO v_fields2
        FROM unnest(v_fields2_arr) AS f;
        -- Campos para SELECT final (com prefixo)
        SELECT string_agg(format('l2.%I AS l2_%s', trim(f), trim(f)), ', ') INTO v_fields2_prefixed
        FROM unnest(v_fields2_arr) AS f;
    ELSE
        -- Pega todos os campos não-geométricos
        SELECT string_agg(quote_ident(column_name), ', ') INTO v_fields2
        FROM information_schema.columns
        WHERE table_schema = v_schema2
        AND table_name = v_table2
        AND column_name != v_geom2
        AND udt_name NOT IN ('geometry', 'geography');

        SELECT string_agg(format('l2.%I AS l2_%s', column_name, column_name), ', ') INTO v_fields2_prefixed
        FROM information_schema.columns
        WHERE table_schema = v_schema2
        AND table_name = v_table2
        AND column_name != v_geom2
        AND udt_name NOT IN ('geometry', 'geography');
    END IF;

    -- =========================================================================
    -- 8. Calcula bounds da tile
    -- =========================================================================
    v_tile_bounds := ST_TileEnvelope(z, x, y);

    -- =========================================================================
    -- 9. OTIMIZAÇÃO: Tolerância e limite baseados no zoom
    -- =========================================================================

    -- Tolerância de simplificação (mais agressiva que tile simples)
    v_simplify_tolerance := CASE
        WHEN z <= 10 THEN 0.0005   -- ~55m
        WHEN z <= 14 THEN 0.0001   -- ~11m
        ELSE 0                      -- sem simplificação
    END;

    -- Limite de features (mais restritivo devido ao JOIN)
    v_feature_limit := CASE
        WHEN z <= 12 THEN 100
        WHEN z <= 14 THEN 500
        WHEN z <= 16 THEN 1000
        ELSE 2000
    END;

    -- =========================================================================
    -- 10. Executa query dinâmica com JOIN espacial
    -- =========================================================================
    IF v_simplify_tolerance > 0 THEN
        -- Com simplificação (ST_MakeValid para corrigir geometrias inválidas)
        EXECUTE format('
            WITH
            filtered_l1 AS (
                SELECT
                    %s,
                    ST_MakeValid(ST_SimplifyPreserveTopology(ST_Transform(%I, 3857), %s)) AS geom_3857
                FROM %I.%I
                WHERE %I && ST_Transform($1, %s)
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            ),
            filtered_l2 AS (
                SELECT
                    %s,
                    ST_MakeValid(ST_SimplifyPreserveTopology(ST_Transform(%I, 3857), %s)) AS geom_3857
                FROM %I.%I
                WHERE %I && ST_Transform($1, %s)
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            )
            SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
                SELECT
                    ST_AsMVTGeom(
                        ST_Intersection(l1.geom_3857, l2.geom_3857),
                        $1, 4096, 64, true
                    ) AS geom,
                    %s,
                    %s
                FROM filtered_l1 l1
                INNER JOIN filtered_l2 l2 ON ST_Intersects(l1.geom_3857, l2.geom_3857)
            ) AS tile
            WHERE geom IS NOT NULL',
            -- Layer 1 CTE: campos originais (sem prefixo)
            COALESCE(v_fields1, '*'),
            v_geom1,                                    -- coluna geom para transform
            v_simplify_tolerance * 111319.9,           -- tolerância em metros
            v_schema1, v_table1,                        -- schema.table
            v_geom1, v_srid1,                           -- filtro espacial
            v_geom1,                                    -- ORDER BY área
            v_feature_limit,                            -- limite
            -- Layer 2 CTE: campos originais (sem prefixo)
            COALESCE(v_fields2, '*'),
            v_geom2,
            v_simplify_tolerance * 111319.9,
            v_schema2, v_table2,
            v_geom2, v_srid2,
            v_geom2,
            v_feature_limit,
            -- Query principal: campos com prefixo
            v_layer_name,
            COALESCE(v_fields1_prefixed, 'l1.*'),
            COALESCE(v_fields2_prefixed, 'l2.*')
        ) INTO v_result USING v_tile_bounds;
    ELSE
        -- Sem simplificação (zoom alto) - ST_MakeValid para geometrias inválidas
        EXECUTE format('
            WITH
            filtered_l1 AS (
                SELECT
                    %s,
                    ST_MakeValid(ST_Transform(%I, 3857)) AS geom_3857
                FROM %I.%I
                WHERE %I && ST_Transform($1, %s)
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            ),
            filtered_l2 AS (
                SELECT
                    %s,
                    ST_MakeValid(ST_Transform(%I, 3857)) AS geom_3857
                FROM %I.%I
                WHERE %I && ST_Transform($1, %s)
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            )
            SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
                SELECT
                    ST_AsMVTGeom(
                        ST_Intersection(l1.geom_3857, l2.geom_3857),
                        $1, 4096, 64, true
                    ) AS geom,
                    %s,
                    %s
                FROM filtered_l1 l1
                INNER JOIN filtered_l2 l2 ON ST_Intersects(l1.geom_3857, l2.geom_3857)
            ) AS tile
            WHERE geom IS NOT NULL',
            -- Layer 1 CTE: campos originais
            COALESCE(v_fields1, '*'),
            v_geom1,
            v_schema1, v_table1,
            v_geom1, v_srid1,
            v_geom1,
            v_feature_limit,
            -- Layer 2 CTE: campos originais
            COALESCE(v_fields2, '*'),
            v_geom2,
            v_schema2, v_table2,
            v_geom2, v_srid2,
            v_geom2,
            v_feature_limit,
            -- Query principal: campos com prefixo
            v_layer_name,
            COALESCE(v_fields1_prefixed, 'l1.*'),
            COALESCE(v_fields2_prefixed, 'l2.*')
        ) INTO v_result USING v_tile_bounds;
    END IF;

    RETURN COALESCE(v_result, ''::bytea);
END;
$$;

COMMENT ON FUNCTION public.get_dynamic_tile_intersection IS
'Função dinâmica para geração de tiles vetoriais com INTERSEÇÃO de duas camadas.
Inclui simplificação adaptativa por zoom e limite de features.

Parâmetros (via query JSON):
  Layer 1:
    - schema1: Schema da tabela 1 (default: cadastro)
    - table1: Nome da tabela 1 (obrigatório)
    - geom1: Coluna de geometria 1 (obrigatório)
    - srid1: SRID da geometria 1 (obrigatório)
    - fields1: Campos a retornar da tabela 1 (opcional)

  Layer 2:
    - schema2: Schema da tabela 2 (default: cadastro)
    - table2: Nome da tabela 2 (obrigatório)
    - geom2: Coluna de geometria 2 (obrigatório)
    - srid2: SRID da geometria 2 (obrigatório)
    - fields2: Campos a retornar da tabela 2 (opcional)

  Output:
    - layer_name: Nome da layer no MVT (default: intersection)

Restrições:
  - Zoom mínimo: 10 (JOIN espacial é pesado)
  - Limites por zoom: z10-12=100, z13-14=500, z15-16=1000, z17+=2000

Exemplo:
  SELECT get_dynamic_tile_intersection(14, 5948, 8960,
    ''{"schema1":"ctm","table1":"cdo_quadra","geom1":"geom","srid1":4326,
       "schema2":"ctm","table2":"ldm_poligono","geom2":"geom","srid2":4326}''::json
  );';

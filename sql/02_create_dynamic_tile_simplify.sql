-- =============================================================================
-- Função dinâmica para geração de tiles vetoriais COM OTIMIZAÇÃO
-- =============================================================================
-- Versão otimizada com:
--   - Simplificação de geometria adaptativa por zoom
--   - Limite de features por tile
--   - Ordenação por área (features maiores primeiro)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dynamic_tile_simplify(
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
    v_schema text;
    v_table text;
    v_geom_column text;
    v_srid integer;
    v_fields text;
    v_fields_arr text[];
    v_result bytea;
    v_field text;
    v_tile_bounds geometry;
    v_source_bounds geometry;
    -- Novas variáveis para otimização
    v_simplify_tolerance float8;
    v_feature_limit integer;
BEGIN
    -- =========================================================================
    -- 1. Extrai parâmetros obrigatórios
    -- =========================================================================
    v_schema := COALESCE(query->>'schema', 'cadastro');
    v_table := query->>'table';
    v_geom_column := query->>'geom';
    v_srid := (query->>'srid')::integer;

    -- Validação de parâmetros obrigatórios
    IF v_table IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "table" é obrigatório';
    END IF;
    IF v_geom_column IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "geom" é obrigatório';
    END IF;
    IF v_srid IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "srid" é obrigatório';
    END IF;

    -- =========================================================================
    -- 2. VALIDAÇÃO: Verifica se tabela existe
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema
        AND table_name = v_table
    ) THEN
        RAISE EXCEPTION 'Tabela %.% não existe', v_schema, v_table;
    END IF;

    -- =========================================================================
    -- 3. VALIDAÇÃO: Verifica se coluna de geometria existe
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema
        AND table_name = v_table
        AND column_name = v_geom_column
    ) THEN
        RAISE EXCEPTION 'Coluna % não existe em %.%', v_geom_column, v_schema, v_table;
    END IF;

    -- =========================================================================
    -- 4. Processa campos
    -- =========================================================================
    IF query->>'fields' IS NOT NULL AND query->>'fields' != '' THEN
        -- Campos específicos (separados por vírgula)
        v_fields_arr := string_to_array(query->>'fields', ',');

        -- Valida cada campo
        FOREACH v_field IN ARRAY v_fields_arr LOOP
            v_field := trim(v_field);
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = v_schema
                AND table_name = v_table
                AND column_name = v_field
            ) THEN
                RAISE EXCEPTION 'Coluna % não existe em %.%', v_field, v_schema, v_table;
            END IF;
        END LOOP;

        -- Monta string de campos com trim e quote_ident para segurança
        SELECT string_agg(quote_ident(trim(f)), ', ') INTO v_fields
        FROM unnest(v_fields_arr) AS f;
    ELSE
        -- Todos os campos (exceto geometria e tipos geométricos)
        SELECT string_agg(quote_ident(column_name), ', ') INTO v_fields
        FROM information_schema.columns
        WHERE table_schema = v_schema
        AND table_name = v_table
        AND column_name != v_geom_column
        AND udt_name NOT IN ('geometry', 'geography');
    END IF;

    -- =========================================================================
    -- 5. Calcula bounds da tile
    -- =========================================================================
    v_tile_bounds := ST_TileEnvelope(z, x, y);
    v_source_bounds := ST_Transform(v_tile_bounds, v_srid);

    -- =========================================================================
    -- 6. OTIMIZAÇÃO: Calcula tolerância e limite baseados no zoom
    -- =========================================================================

    -- Tolerância de simplificação (em graus para SRID 4326)
    -- Quanto menor o zoom, maior a simplificação
    v_simplify_tolerance := CASE
        WHEN z <= 6  THEN 0.001    -- ~111m - visão continental
        WHEN z <= 10 THEN 0.0005   -- ~55m  - visão regional
        WHEN z <= 14 THEN 0.0001   -- ~11m  - visão cidade/bairro
        ELSE 0                      -- sem simplificação - zoom detalhado
    END;

    -- Limite de features por tile
    -- Quanto menor o zoom, menos features (evita tiles gigantes)
    v_feature_limit := CASE
        WHEN z <= 6  THEN 500
        WHEN z <= 10 THEN 2000
        WHEN z <= 14 THEN 5000
        ELSE 10000
    END;

    -- =========================================================================
    -- 7. Executa query dinâmica COM OTIMIZAÇÕES
    -- =========================================================================
    IF v_simplify_tolerance > 0 THEN
        -- Com simplificação
        EXECUTE format(
            'SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
                SELECT
                    ST_AsMVTGeom(
                        ST_SimplifyPreserveTopology(
                            ST_Transform(%I, 3857),
                            %L * 111319.9
                        ),
                        $1,
                        4096, 64, true
                    ) AS geom,
                    %s
                FROM %I.%I
                WHERE %I && $2
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            ) AS tile WHERE geom IS NOT NULL',
            v_table,                -- layer name no MVT
            v_geom_column,          -- coluna de geometria para transform
            v_simplify_tolerance,   -- tolerância em graus (convertida para metros)
            v_fields,               -- campos selecionados (já com quote_ident)
            v_schema,               -- schema
            v_table,                -- tabela
            v_geom_column,          -- coluna para filtro espacial
            v_geom_column,          -- coluna para ORDER BY área
            v_feature_limit         -- limite de features
        ) INTO v_result USING v_tile_bounds, v_source_bounds;
    ELSE
        -- Sem simplificação (zoom alto)
        EXECUTE format(
            'SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
                SELECT
                    ST_AsMVTGeom(
                        ST_Transform(%I, 3857),
                        $1,
                        4096, 64, true
                    ) AS geom,
                    %s
                FROM %I.%I
                WHERE %I && $2
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            ) AS tile WHERE geom IS NOT NULL',
            v_table,                -- layer name no MVT
            v_geom_column,          -- coluna de geometria
            v_fields,               -- campos selecionados (já com quote_ident)
            v_schema,               -- schema
            v_table,                -- tabela
            v_geom_column,          -- coluna para filtro espacial
            v_geom_column,          -- coluna para ORDER BY área
            v_feature_limit         -- limite de features
        ) INTO v_result USING v_tile_bounds, v_source_bounds;
    END IF;

    RETURN COALESCE(v_result, ''::bytea);
END;
$$;

COMMENT ON FUNCTION public.get_dynamic_tile_simplify IS
'Função dinâmica OTIMIZADA para geração de tiles vetoriais.
Inclui simplificação adaptativa por zoom e limite de features.

Parâmetros (via query JSON):
  - schema: Schema da tabela (default: cadastro)
  - table: Nome da tabela (obrigatório)
  - geom: Nome da coluna de geometria (obrigatório)
  - srid: SRID da geometria fonte (obrigatório)
  - fields: Campos a retornar separados por vírgula (opcional, default: todos)

Otimizações automáticas por zoom:
  - z <= 6:  simplificação ~111m, limite 500 features
  - z <= 10: simplificação ~55m,  limite 2000 features
  - z <= 14: simplificação ~11m,  limite 5000 features
  - z > 14:  sem simplificação,   limite 10000 features

Exemplo de uso:
  SELECT get_dynamic_tile_simplify(10, 372, 560,
    ''{"schema":"cadastro","table":"lote","geom":"geom","srid":4326,"fields":"id,inscricao"}''::json
  );';

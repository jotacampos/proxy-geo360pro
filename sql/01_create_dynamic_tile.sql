-- =============================================================================
-- Função dinâmica para geração de tiles vetoriais
-- =============================================================================
-- Recebe parâmetros via query string e gera MVT dinamicamente
-- Validação apenas de existência (via information_schema), não de permissões
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dynamic_tile(
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
    -- 6. Executa query dinâmica
    -- =========================================================================
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
        ) AS tile WHERE geom IS NOT NULL',
        v_table,                -- layer name no MVT
        v_geom_column,          -- coluna de geometria
        v_fields,               -- campos selecionados (já com quote_ident)
        v_schema,               -- schema
        v_table,                -- tabela
        v_geom_column           -- coluna para filtro espacial
    ) INTO v_result USING v_tile_bounds, v_source_bounds;

    RETURN COALESCE(v_result, ''::bytea);
END;
$$;

COMMENT ON FUNCTION public.get_dynamic_tile IS
'Função dinâmica para geração de tiles vetoriais.
Parâmetros (via query JSON):
  - schema: Schema da tabela (default: cadastro)
  - table: Nome da tabela (obrigatório)
  - geom: Nome da coluna de geometria (obrigatório)
  - srid: SRID da geometria fonte (obrigatório)
  - fields: Campos a retornar separados por vírgula (opcional, default: todos)
Exemplo de uso:
  SELECT get_dynamic_tile(14, 5966, 9474,
    ''{"schema":"cadastro","table":"lote","geom":"geom","srid":4326,"fields":"id,inscricao"}''::json
  );';

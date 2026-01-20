-- =============================================================================
-- Função dinâmica para geração de tiles vetoriais com BUFFER
-- =============================================================================
-- Cria área de influência (buffer) ao redor das geometrias de uma camada
-- Útil para análises de proximidade:
--   - Lotes a X metros de uma via
--   - Edificações dentro de área de APP
--   - Área de influência de equipamentos públicos
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dynamic_tile_buffer(
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
    -- Parâmetros da camada
    v_schema text;
    v_table text;
    v_geom text;
    v_srid integer;
    v_fields text;
    v_fields_arr text[];
    v_fields_select text;

    -- Parâmetros do buffer
    v_buffer_meters float8;
    v_buffer_segments integer;
    v_dissolve boolean;

    -- Output
    v_layer_name text;

    -- Internos
    v_tile_bounds geometry;
    v_expanded_bounds geometry;
    v_feature_limit integer;
    v_simplify_tolerance float8;
    v_result bytea;
BEGIN
    -- =========================================================================
    -- 1. Extrai parâmetros da camada
    -- =========================================================================
    v_schema := COALESCE(query->>'schema', 'cadastro');
    v_table := query->>'table';
    v_geom := query->>'geom';
    v_srid := (query->>'srid')::integer;

    IF v_table IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "table" é obrigatório';
    END IF;
    IF v_geom IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "geom" é obrigatório';
    END IF;
    IF v_srid IS NULL THEN
        RAISE EXCEPTION 'Parâmetro "srid" é obrigatório';
    END IF;

    -- =========================================================================
    -- 2. Extrai parâmetros do buffer
    -- =========================================================================
    v_buffer_meters := COALESCE((query->>'buffer_meters')::float8, 100.0);
    v_buffer_segments := COALESCE((query->>'buffer_segments')::integer, 8);
    v_dissolve := COALESCE((query->>'dissolve')::boolean, false);

    -- Validação
    IF v_buffer_meters <= 0 THEN
        RAISE EXCEPTION 'buffer_meters deve ser maior que 0 (atual: %)', v_buffer_meters;
    END IF;
    IF v_buffer_meters > 10000 THEN
        RAISE EXCEPTION 'buffer_meters muito grande (máximo: 10000m, atual: %)', v_buffer_meters;
    END IF;

    -- Output config
    v_layer_name := COALESCE(query->>'layer_name', 'buffer');

    -- =========================================================================
    -- 3. Validação: Verifica se tabela existe
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = v_schema AND table_name = v_table
    ) THEN
        RAISE EXCEPTION 'Tabela %.% não existe', v_schema, v_table;
    END IF;

    -- =========================================================================
    -- 4. Validação: Verifica se coluna de geometria existe
    -- =========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = v_schema AND table_name = v_table AND column_name = v_geom
    ) THEN
        RAISE EXCEPTION 'Coluna % não existe em %.%', v_geom, v_schema, v_table;
    END IF;

    -- =========================================================================
    -- 5. Processa campos
    -- =========================================================================
    IF query->>'fields' IS NOT NULL AND query->>'fields' != '' THEN
        v_fields_arr := string_to_array(query->>'fields', ',');
        SELECT string_agg(quote_ident(trim(f)), ', ') INTO v_fields_select
        FROM unnest(v_fields_arr) AS f;
    ELSE
        -- Pega todos os campos não-geométricos
        SELECT string_agg(quote_ident(column_name), ', ') INTO v_fields_select
        FROM information_schema.columns
        WHERE table_schema = v_schema
        AND table_name = v_table
        AND column_name != v_geom
        AND udt_name NOT IN ('geometry', 'geography');
    END IF;

    -- =========================================================================
    -- 6. Calcula bounds da tile (expandido pelo buffer)
    -- =========================================================================
    v_tile_bounds := ST_TileEnvelope(z, x, y);

    -- Expandir bounds pelo tamanho do buffer para pegar features que podem
    -- ter o buffer entrando na tile
    -- Converter metros para graus aproximados (1 grau ≈ 111km no equador)
    v_expanded_bounds := ST_Expand(v_tile_bounds, v_buffer_meters / 111319.9 * 1.5);

    -- =========================================================================
    -- 7. Tolerância e limite baseados no zoom
    -- =========================================================================
    v_simplify_tolerance := CASE
        WHEN z <= 10 THEN 0.0005
        WHEN z <= 14 THEN 0.0001
        ELSE 0
    END;

    v_feature_limit := CASE
        WHEN z <= 12 THEN 200
        WHEN z <= 14 THEN 500
        WHEN z <= 16 THEN 1000
        ELSE 2000
    END;

    -- =========================================================================
    -- 8. Executa query dinâmica
    -- =========================================================================
    IF v_dissolve THEN
        -- Com dissolve: une todos os buffers em uma única geometria
        EXECUTE format('
            WITH
            source_data AS (
                SELECT %s, %I as geom
                FROM %I.%I
                WHERE %I && ST_Transform($2, %s)
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            ),
            buffered AS (
                SELECT
                    ST_Union(
                        ST_Buffer(
                            ST_Transform(geom, 3857),
                            %s
                        )
                    ) as geom_buffer
                FROM source_data
            ),
            simplified AS (
                SELECT
                    CASE WHEN %s > 0
                        THEN ST_SimplifyPreserveTopology(geom_buffer, %s * 111319.9)
                        ELSE geom_buffer
                    END as geom_final
                FROM buffered
                WHERE geom_buffer IS NOT NULL
            )
            SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
                SELECT
                    ST_AsMVTGeom(geom_final, $1, 4096, 64, true) AS geom,
                    ''dissolved'' as buffer_type
                FROM simplified
                WHERE geom_final IS NOT NULL
            ) AS tile',
            COALESCE(v_fields_select, '1'),  -- campos (ou dummy)
            v_geom,
            v_schema, v_table,
            v_geom, v_srid,
            v_geom,
            v_feature_limit,
            v_buffer_meters,
            v_simplify_tolerance,
            v_simplify_tolerance,
            v_layer_name
        ) INTO v_result USING v_tile_bounds, v_expanded_bounds;
    ELSE
        -- Sem dissolve: buffer individual por feature
        EXECUTE format('
            WITH
            source_data AS (
                SELECT %s, %I as geom
                FROM %I.%I
                WHERE %I && ST_Transform($2, %s)
                ORDER BY ST_Area(%I::geography) DESC
                LIMIT %s
            ),
            buffered AS (
                SELECT
                    %s,
                    ST_Buffer(
                        ST_Transform(geom, 3857),
                        %s,
                        %s
                    ) as geom_buffer
                FROM source_data
            ),
            simplified AS (
                SELECT
                    %s,
                    CASE WHEN %s > 0
                        THEN ST_SimplifyPreserveTopology(geom_buffer, %s * 111319.9)
                        ELSE geom_buffer
                    END as geom_final
                FROM buffered
                WHERE geom_buffer IS NOT NULL
            )
            SELECT ST_AsMVT(tile, %L, 4096, ''geom'') FROM (
                SELECT
                    ST_AsMVTGeom(geom_final, $1, 4096, 64, true) AS geom,
                    %s
                FROM simplified
                WHERE geom_final IS NOT NULL
            ) AS tile',
            -- source_data SELECT
            COALESCE(v_fields_select, '1'),
            v_geom,
            v_schema, v_table,
            v_geom, v_srid,
            v_geom,
            v_feature_limit,
            -- buffered SELECT
            COALESCE(v_fields_select, '1'),
            v_buffer_meters,
            v_buffer_segments,
            -- simplified SELECT
            COALESCE(v_fields_select, '1'),
            v_simplify_tolerance,
            v_simplify_tolerance,
            -- MVT
            v_layer_name,
            COALESCE(v_fields_select, '1')
        ) INTO v_result USING v_tile_bounds, v_expanded_bounds;
    END IF;

    RETURN COALESCE(v_result, ''::bytea);
END;
$$;

COMMENT ON FUNCTION public.get_dynamic_tile_buffer IS
'Função dinâmica para geração de tiles vetoriais com BUFFER.
Cria área de influência ao redor das geometrias.

Parâmetros (via query JSON):
  Camada:
    - schema: Schema da tabela (default: cadastro)
    - table: Nome da tabela (obrigatório)
    - geom: Coluna de geometria (obrigatório)
    - srid: SRID da geometria (obrigatório)
    - fields: Campos a retornar (opcional)

  Buffer:
    - buffer_meters: Distância do buffer em metros (default: 100)
    - buffer_segments: Segmentos por quadrante para círculos (default: 8)
    - dissolve: Se true, une todos os buffers (default: false)

  Output:
    - layer_name: Nome da layer no MVT (default: buffer)

Exemplo:
  -- Buffer de 50m ao redor de vias
  SELECT get_dynamic_tile_buffer(14, 5948, 8960,
    ''{"schema":"infraestrutura","table":"vias","geom":"geom","srid":4326,
       "buffer_meters":50,"fields":"id,nome"}''::json
  );

  -- Buffer dissolvido (área única)
  SELECT get_dynamic_tile_buffer(14, 5948, 8960,
    ''{"schema":"meio_ambiente","table":"app","geom":"geom","srid":4326,
       "buffer_meters":30,"dissolve":true}''::json
  );';

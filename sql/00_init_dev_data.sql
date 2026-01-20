-- =============================================================================
-- Dados de teste para ambiente de desenvolvimento
-- =============================================================================
-- Cenários cobertos:
--   1. Múltiplos schemas: cadastro, rural, infraestrutura, meio_ambiente
--   2. Diferentes SRIDs: 4326 (WGS84), 31982 (UTM 22S), 31983 (UTM 23S)
--   3. Diferentes nomes de coluna de geometria: geom, geometria, shape, the_geom, geo
--   4. Diferentes tipos de geometria: Polygon, Point, LineString, MultiPolygon
-- =============================================================================

-- Habilita PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================================
-- SCHEMA: cadastro (principal)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS cadastro;

-- Tabela 1: Lotes com SRID 4326, coluna "geom"
CREATE TABLE cadastro.lotes (
    id SERIAL PRIMARY KEY,
    inscricao VARCHAR(50),
    area NUMERIC(12,2),
    valor_venal NUMERIC(14,2),
    bairro VARCHAR(100),
    geom GEOMETRY(Polygon, 4326)
);

INSERT INTO cadastro.lotes (inscricao, area, valor_venal, bairro, geom) VALUES
('001.001.0001', 500.00, 150000.00, 'Centro',
 ST_GeomFromText('POLYGON((-48.92 -27.10, -48.92 -27.101, -48.919 -27.101, -48.919 -27.10, -48.92 -27.10))', 4326)),
('001.001.0002', 750.00, 225000.00, 'Centro',
 ST_GeomFromText('POLYGON((-48.919 -27.10, -48.919 -27.101, -48.918 -27.101, -48.918 -27.10, -48.919 -27.10))', 4326)),
('001.002.0001', 300.00, 90000.00, 'Azambuja',
 ST_GeomFromText('POLYGON((-48.925 -27.105, -48.925 -27.106, -48.924 -27.106, -48.924 -27.105, -48.925 -27.105))', 4326)),
('001.002.0002', 450.00, 135000.00, 'Azambuja',
 ST_GeomFromText('POLYGON((-48.924 -27.105, -48.924 -27.106, -48.923 -27.106, -48.923 -27.105, -48.924 -27.105))', 4326)),
('001.003.0001', 600.00, 180000.00, 'Jardim',
 ST_GeomFromText('POLYGON((-48.915 -27.095, -48.915 -27.096, -48.914 -27.096, -48.914 -27.095, -48.915 -27.095))', 4326));

CREATE INDEX idx_cadastro_lotes_geom ON cadastro.lotes USING GIST (geom);

-- Tabela 2: Edificações com SRID 31982 (UTM 22S), coluna "geometria"
CREATE TABLE cadastro.edificacoes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    pavimentos INTEGER,
    area_construida NUMERIC(10,2),
    geometria GEOMETRY(Polygon, 31982)
);

INSERT INTO cadastro.edificacoes (tipo, pavimentos, area_construida, geometria) VALUES
('Residencial', 2, 150.00,
 ST_GeomFromText('POLYGON((714000 6998000, 714000 6998010, 714010 6998010, 714010 6998000, 714000 6998000))', 31982)),
('Comercial', 3, 300.00,
 ST_GeomFromText('POLYGON((714020 6998000, 714020 6998015, 714035 6998015, 714035 6998000, 714020 6998000))', 31982)),
('Industrial', 1, 500.00,
 ST_GeomFromText('POLYGON((714050 6998000, 714050 6998025, 714075 6998025, 714075 6998000, 714050 6998000))', 31982));

CREATE INDEX idx_cadastro_edificacoes_geom ON cadastro.edificacoes USING GIST (geometria);

-- Tabela 3: Pontos de interesse com SRID 4326, coluna "geom"
CREATE TABLE cadastro.pontos_interesse (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100),
    categoria VARCHAR(50),
    geom GEOMETRY(Point, 4326)
);

INSERT INTO cadastro.pontos_interesse (nome, categoria, geom) VALUES
('Prefeitura', 'Público', ST_GeomFromText('POINT(-48.92 -27.10)', 4326)),
('Hospital', 'Saúde', ST_GeomFromText('POINT(-48.918 -27.102)', 4326)),
('Escola Municipal', 'Educação', ST_GeomFromText('POINT(-48.925 -27.105)', 4326));

CREATE INDEX idx_cadastro_pontos_geom ON cadastro.pontos_interesse USING GIST (geom);

-- =============================================================================
-- SCHEMA: rural
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS rural;

-- Tabela 1: Propriedades rurais com SRID 4326, coluna "shape"
CREATE TABLE rural.propriedades (
    id SERIAL PRIMARY KEY,
    nome_propriedade VARCHAR(200),
    proprietario VARCHAR(200),
    area_hectares NUMERIC(12,4),
    car VARCHAR(50),
    shape GEOMETRY(Polygon, 4326)
);

INSERT INTO rural.propriedades (nome_propriedade, proprietario, area_hectares, car, shape) VALUES
('Fazenda Santa Maria', 'João Silva', 150.5000, 'SC-1234567-ABCD',
 ST_GeomFromText('POLYGON((-48.90 -27.05, -48.90 -27.07, -48.88 -27.07, -48.88 -27.05, -48.90 -27.05))', 4326)),
('Sítio Esperança', 'Maria Santos', 45.2500, 'SC-7654321-EFGH',
 ST_GeomFromText('POLYGON((-48.88 -27.05, -48.88 -27.06, -48.87 -27.06, -48.87 -27.05, -48.88 -27.05))', 4326)),
('Chácara do Sol', 'Pedro Costa', 12.7500, 'SC-9999999-IJKL',
 ST_GeomFromText('POLYGON((-48.87 -27.05, -48.87 -27.055, -48.865 -27.055, -48.865 -27.05, -48.87 -27.05))', 4326));

CREATE INDEX idx_rural_propriedades_shape ON rural.propriedades USING GIST (shape);

-- Tabela 2: Reservas legais com SRID 31983 (UTM 23S), coluna "the_geom"
CREATE TABLE rural.reservas_legais (
    id SERIAL PRIMARY KEY,
    propriedade_id INTEGER,
    percentual NUMERIC(5,2),
    situacao VARCHAR(50),
    the_geom GEOMETRY(MultiPolygon, 31983)
);

INSERT INTO rural.reservas_legais (propriedade_id, percentual, situacao, the_geom) VALUES
(1, 20.00, 'Averbada',
 ST_GeomFromText('MULTIPOLYGON(((500000 7000000, 500000 7001000, 501000 7001000, 501000 7000000, 500000 7000000)))', 31983)),
(2, 20.00, 'Pendente',
 ST_GeomFromText('MULTIPOLYGON(((501000 7000000, 501000 7000500, 501500 7000500, 501500 7000000, 501000 7000000)))', 31983));

CREATE INDEX idx_rural_reservas_the_geom ON rural.reservas_legais USING GIST (the_geom);

-- =============================================================================
-- SCHEMA: infraestrutura
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS infraestrutura;

-- Tabela 1: Vias com SRID 4326, coluna "geo" (LineString)
CREATE TABLE infraestrutura.vias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200),
    tipo VARCHAR(50),
    largura_metros NUMERIC(5,2),
    pavimentacao VARCHAR(50),
    geo GEOMETRY(LineString, 4326)
);

INSERT INTO infraestrutura.vias (nome, tipo, largura_metros, pavimentacao, geo) VALUES
('Av. Brasil', 'Avenida', 20.00, 'Asfalto',
 ST_GeomFromText('LINESTRING(-48.93 -27.10, -48.91 -27.10, -48.90 -27.095)', 4326)),
('Rua das Flores', 'Rua', 12.00, 'Asfalto',
 ST_GeomFromText('LINESTRING(-48.92 -27.11, -48.92 -27.10, -48.92 -27.09)', 4326)),
('Travessa do Comércio', 'Travessa', 8.00, 'Paralelepípedo',
 ST_GeomFromText('LINESTRING(-48.919 -27.105, -48.918 -27.105)', 4326));

CREATE INDEX idx_infra_vias_geo ON infraestrutura.vias USING GIST (geo);

-- Tabela 2: Redes de água com SRID 31982, coluna "geom" (LineString)
CREATE TABLE infraestrutura.rede_agua (
    id SERIAL PRIMARY KEY,
    diametro_mm INTEGER,
    material VARCHAR(50),
    pressao_bar NUMERIC(5,2),
    geom GEOMETRY(LineString, 31982)
);

INSERT INTO infraestrutura.rede_agua (diametro_mm, material, pressao_bar, geom) VALUES
(200, 'PVC', 4.5,
 ST_GeomFromText('LINESTRING(714000 6998000, 714100 6998000, 714100 6998100)', 31982)),
(150, 'Ferro Fundido', 5.0,
 ST_GeomFromText('LINESTRING(714100 6998000, 714200 6998000)', 31982)),
(100, 'PEAD', 3.5,
 ST_GeomFromText('LINESTRING(714000 6998100, 714000 6998200)', 31982));

CREATE INDEX idx_infra_rede_agua_geom ON infraestrutura.rede_agua USING GIST (geom);

-- Tabela 3: Postes com SRID 4326, coluna "localizacao" (Point)
CREATE TABLE infraestrutura.postes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20),
    tipo VARCHAR(50),
    altura_metros NUMERIC(4,2),
    localizacao GEOMETRY(Point, 4326)
);

INSERT INTO infraestrutura.postes (codigo, tipo, altura_metros, localizacao) VALUES
('PST-001', 'Concreto', 12.00, ST_GeomFromText('POINT(-48.92 -27.10)', 4326)),
('PST-002', 'Metálico', 10.00, ST_GeomFromText('POINT(-48.919 -27.10)', 4326)),
('PST-003', 'Concreto', 12.00, ST_GeomFromText('POINT(-48.918 -27.10)', 4326)),
('PST-004', 'Madeira', 8.00, ST_GeomFromText('POINT(-48.925 -27.105)', 4326));

CREATE INDEX idx_infra_postes_loc ON infraestrutura.postes USING GIST (localizacao);

-- =============================================================================
-- SCHEMA: meio_ambiente
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS meio_ambiente;

-- Tabela 1: Áreas de preservação com SRID 4326, coluna "geometria"
CREATE TABLE meio_ambiente.areas_preservacao (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200),
    tipo VARCHAR(100),
    area_km2 NUMERIC(10,4),
    decreto VARCHAR(50),
    geometria GEOMETRY(MultiPolygon, 4326)
);

INSERT INTO meio_ambiente.areas_preservacao (nome, tipo, area_km2, decreto, geometria) VALUES
('Parque Municipal', 'Parque', 2.5000, 'DEC-123/2020',
 ST_GeomFromText('MULTIPOLYGON(((-48.95 -27.08, -48.95 -27.10, -48.93 -27.10, -48.93 -27.08, -48.95 -27.08)))', 4326)),
('APP Rio Principal', 'APP', 0.8500, 'LEI-456/2018',
 ST_GeomFromText('MULTIPOLYGON(((-48.92 -27.095, -48.92 -27.105, -48.915 -27.105, -48.915 -27.095, -48.92 -27.095)))', 4326));

CREATE INDEX idx_ma_areas_geometria ON meio_ambiente.areas_preservacao USING GIST (geometria);

-- Tabela 2: Nascentes com SRID 31982, coluna "ponto" (Point)
CREATE TABLE meio_ambiente.nascentes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20),
    vazao_litros_hora NUMERIC(10,2),
    qualidade VARCHAR(50),
    ponto GEOMETRY(Point, 31982)
);

INSERT INTO meio_ambiente.nascentes (codigo, vazao_litros_hora, qualidade, ponto) VALUES
('NSC-001', 500.00, 'Boa', ST_GeomFromText('POINT(714500 6998500)', 31982)),
('NSC-002', 250.00, 'Regular', ST_GeomFromText('POINT(714600 6998600)', 31982)),
('NSC-003', 1200.00, 'Excelente', ST_GeomFromText('POINT(714700 6998700)', 31982));

CREATE INDEX idx_ma_nascentes_ponto ON meio_ambiente.nascentes USING GIST (ponto);

-- Tabela 3: Cursos d'água com SRID 4326, coluna "traçado" (LineString)
-- Nome com acento para testar encoding
CREATE TABLE meio_ambiente.cursos_dagua (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200),
    extensao_km NUMERIC(8,2),
    classe INTEGER,
    tracado GEOMETRY(LineString, 4326)
);

INSERT INTO meio_ambiente.cursos_dagua (nome, extensao_km, classe, tracado) VALUES
('Rio Principal', 15.50, 1,
 ST_GeomFromText('LINESTRING(-48.95 -27.08, -48.92 -27.10, -48.90 -27.12)', 4326)),
('Córrego do Vale', 3.20, 3,
 ST_GeomFromText('LINESTRING(-48.93 -27.09, -48.92 -27.10)', 4326)),
('Ribeirão Norte', 8.75, 2,
 ST_GeomFromText('LINESTRING(-48.90 -27.05, -48.92 -27.08, -48.92 -27.10)', 4326));

CREATE INDEX idx_ma_cursos_tracado ON meio_ambiente.cursos_dagua USING GIST (tracado);

-- =============================================================================
-- Tabela de referência cruzada para testes
-- =============================================================================
CREATE TABLE public.cenarios_teste (
    id SERIAL PRIMARY KEY,
    schema_name VARCHAR(50),
    table_name VARCHAR(100),
    geom_column VARCHAR(50),
    srid INTEGER,
    geom_type VARCHAR(50),
    descricao TEXT
);

INSERT INTO public.cenarios_teste (schema_name, table_name, geom_column, srid, geom_type, descricao) VALUES
('cadastro', 'lotes', 'geom', 4326, 'Polygon', 'Lotes urbanos - caso padrão'),
('cadastro', 'edificacoes', 'geometria', 31982, 'Polygon', 'Edificações com SRID UTM 22S'),
('cadastro', 'pontos_interesse', 'geom', 4326, 'Point', 'Pontos de interesse'),
('rural', 'propriedades', 'shape', 4326, 'Polygon', 'Propriedades rurais com coluna "shape"'),
('rural', 'reservas_legais', 'the_geom', 31983, 'MultiPolygon', 'Reservas legais com SRID UTM 23S e coluna "the_geom"'),
('infraestrutura', 'vias', 'geo', 4326, 'LineString', 'Vias com coluna "geo"'),
('infraestrutura', 'rede_agua', 'geom', 31982, 'LineString', 'Rede de água com SRID UTM 22S'),
('infraestrutura', 'postes', 'localizacao', 4326, 'Point', 'Postes com coluna "localizacao"'),
('meio_ambiente', 'areas_preservacao', 'geometria', 4326, 'MultiPolygon', 'Áreas de preservação'),
('meio_ambiente', 'nascentes', 'ponto', 31982, 'Point', 'Nascentes com coluna "ponto" e SRID UTM 22S'),
('meio_ambiente', 'cursos_dagua', 'tracado', 4326, 'LineString', 'Cursos d água com coluna "tracado"');

-- =============================================================================
-- Resumo das configurações de teste
-- =============================================================================
--
-- SCHEMAS: cadastro, rural, infraestrutura, meio_ambiente
--
-- SRIDS utilizados:
--   - 4326  (WGS84 - lat/lon)
--   - 31982 (SIRGAS 2000 / UTM zone 22S)
--   - 31983 (SIRGAS 2000 / UTM zone 23S)
--
-- COLUNAS DE GEOMETRIA:
--   - geom (padrão)
--   - geometria
--   - shape
--   - the_geom
--   - geo
--   - localizacao
--   - ponto
--   - tracado
--
-- TIPOS DE GEOMETRIA:
--   - Polygon
--   - MultiPolygon
--   - Point
--   - LineString
-- =============================================================================

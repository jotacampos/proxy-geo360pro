-- Script para criar tabelas base necessárias para o api-geo360
-- Estas tabelas eram originalmente criadas pelo Django

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- Schemas necessários (já criados anteriormente)
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS sys_data;

-- django_content_type (necessário para permissões)
CREATE TABLE IF NOT EXISTS django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    UNIQUE (app_label, model)
);

-- auth_permission (sistema de permissões)
CREATE TABLE IF NOT EXISTS auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id),
    codename VARCHAR(100) NOT NULL,
    UNIQUE (content_type_id, codename)
);

-- auth_group (grupos de usuários)
CREATE TABLE IF NOT EXISTS auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

-- core_organization (organizações/tenants)
CREATE TABLE IF NOT EXISTS core_organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- core_organization_group (grupos de organização)
CREATE TABLE IF NOT EXISTS core_organization_group (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES core_organization(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- auth_user (usuários)
CREATE TABLE IF NOT EXISTS auth_user (
    id SERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMPTZ,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    username VARCHAR(150) NOT NULL UNIQUE,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auth_user_groups (relação muitos-para-muitos entre user e group)
CREATE TABLE IF NOT EXISTS auth_user_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_user(id),
    group_id INTEGER NOT NULL REFERENCES auth_group(id),
    UNIQUE (user_id, group_id)
);

-- guardian_groupobjectpermission (permissões por objeto para grupos)
CREATE TABLE IF NOT EXISTS guardian_groupobjectpermission (
    id SERIAL PRIMARY KEY,
    object_pk VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id),
    group_id INTEGER NOT NULL REFERENCES auth_group(id),
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id)
);

-- guardian_userobjectpermission (permissões por objeto para usuários)
CREATE TABLE IF NOT EXISTS guardian_userobjectpermission (
    id SERIAL PRIMARY KEY,
    object_pk VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id),
    user_id INTEGER NOT NULL REFERENCES auth_user(id),
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id)
);

-- core_connection (conexões de banco por schema/tenant)
CREATE TABLE IF NOT EXISTS core_connection (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    related_schema VARCHAR(255),
    organization_id UUID REFERENCES core_organization(id),
    is_default BOOLEAN DEFAULT FALSE,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- core_user (extensão do auth_user com campos adicionais)
CREATE TABLE IF NOT EXISTS core_user (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES auth_user(id),
    organization_id UUID REFERENCES core_organization(id),
    profile_image VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- core_organization_user (relação usuário-organização)
CREATE TABLE IF NOT EXISTS core_organization_user (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_user(id),
    organization_id UUID NOT NULL REFERENCES core_organization(id),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (user_id, organization_id)
);

-- Dados iniciais

-- Content types básicos
INSERT INTO django_content_type (app_label, model) VALUES
    ('auth', 'user'),
    ('auth', 'group'),
    ('auth', 'permission'),
    ('core', 'layer'),
    ('core', 'connection')
ON CONFLICT (app_label, model) DO NOTHING;

-- Organização padrão para desenvolvimento
INSERT INTO core_organization (id, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Dev Organization')
ON CONFLICT (id) DO NOTHING;

-- Grupo padrão para a organização
INSERT INTO core_organization_group (id, name, organization_id) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Default Group', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Grupo de autenticação padrão
INSERT INTO auth_group (id, name) VALUES
    (1, 'Default Group')
ON CONFLICT (id) DO NOTHING;

-- Usuário admin para desenvolvimento
INSERT INTO auth_user (id, password, is_superuser, username, first_name, last_name, email, is_staff, is_active) VALUES
    (1, 'pbkdf2_sha256$320000$dummy$dummyhash=', TRUE, 'admin', 'Admin', 'User', 'admin@dev.local', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Associar usuário admin ao grupo
INSERT INTO auth_user_groups (user_id, group_id) VALUES
    (1, 1)
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Conexão padrão apontando para nosso schema de testes
INSERT INTO core_connection (id, name, related_schema, organization_id, is_default, config) VALUES
    ('00000000-0000-0000-0000-000000000001',
     'Dev Connection',
     'cadastro',
     '00000000-0000-0000-0000-000000000001',
     TRUE,
     '{
       "tiles_urls": {
         "live_url": "http://localhost:8081/tiles",
         "static_url": "http://localhost:8081/tiles"
       }
     }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Associar usuário à organização
INSERT INTO core_organization_user (user_id, organization_id, is_default) VALUES
    (1, '00000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Permissões básicas para layers
INSERT INTO auth_permission (name, content_type_id, codename)
SELECT 'View Layer', id, 'view_layer' FROM django_content_type WHERE app_label = 'core' AND model = 'layer'
ON CONFLICT (content_type_id, codename) DO NOTHING;

INSERT INTO auth_permission (name, content_type_id, codename)
SELECT 'Add Layer', id, 'add_layer' FROM django_content_type WHERE app_label = 'core' AND model = 'layer'
ON CONFLICT (content_type_id, codename) DO NOTHING;

INSERT INTO auth_permission (name, content_type_id, codename)
SELECT 'Change Layer', id, 'change_layer' FROM django_content_type WHERE app_label = 'core' AND model = 'layer'
ON CONFLICT (content_type_id, codename) DO NOTHING;

INSERT INTO auth_permission (name, content_type_id, codename)
SELECT 'Delete Layer', id, 'delete_layer' FROM django_content_type WHERE app_label = 'core' AND model = 'layer'
ON CONFLICT (content_type_id, codename) DO NOTHING;

SELECT 'Base tables created successfully!' as status;

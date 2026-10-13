-- Reproduz localmente o que o Supabase já traz pronto, para as migrações do
-- projeto rodarem sem alteração: papéis, schema auth com auth.uid(), e storage.
-- Isto NÃO vai para produção — serve só para testar as migrações de verdade.

drop role if exists anon; create role anon nologin noinherit;
drop role if exists authenticated; create role authenticated nologin noinherit;
drop role if exists service_role; create role service_role nologin noinherit bypassrls;
grant anon, authenticated, service_role to postgres;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);
grant usage on schema auth to anon, authenticated, service_role;

-- No Supabase, auth.uid() lê o JWT. Aqui lê uma variável de sessão, que o teste
-- define para simular "quem está logado".
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- Permissões que o Supabase concede por padrão no schema public.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

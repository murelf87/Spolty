-- Solo para las pruebas locales (nunca en la nube): funciones que usa supabase/tests/fake-supabase.mjs para emular
-- la API de Storage y el alta de usuarios de Supabase sobre las mismas tablas y políticas RLS de la migración.
create schema if not exists test_api;
grant usage on schema test_api to anon, authenticated, service_role;

-- Subir: inserta la fila del archivo con el rol y el JWT de quien sube, así se aplican las políticas de storage.
create function test_api.storage_insert(p_bucket text, p_name text) returns void language sql security invoker as $$
  insert into storage.objects (bucket_id, name) values (p_bucket, p_name)
$$;
-- Leer un archivo privado (URL firmada): solo si las políticas de storage le dejan verlo.
create function test_api.storage_can_read(p_bucket text, p_name text) returns boolean language sql security invoker stable as $$
  select exists (select 1 from storage.objects where bucket_id = p_bucket and name = p_name)
$$;
create function test_api.storage_delete(p_bucket text, p_name text) returns integer language sql security invoker as $$
  with d as (delete from storage.objects where bucket_id = p_bucket and name = p_name returning 1) select count(*)::int from d
$$;
-- Listar (lo que las políticas dejan ver a quien pregunta): archivos directamente dentro de la carpeta.
create function test_api.storage_list(p_bucket text, p_prefix text) returns table (name text, id uuid, created_at timestamptz) language sql security invoker stable as $$
  select o.name, o.id, o.created_at from storage.objects o
  where o.bucket_id = p_bucket and o.name like rtrim(p_prefix, '/') || '/%' and position('/' in substr(o.name, char_length(rtrim(p_prefix, '/')) + 2)) = 0
$$;
-- Alta de usuario (lo que haría GoTrue), con el disparador real que crea el perfil.
create function test_api.create_user(p_email text, p_meta jsonb) returns uuid language sql security definer set search_path = public as $$
  insert into auth.users (email, raw_user_meta_data) values (p_email, coalesce(p_meta, '{}'::jsonb)) returning id
$$;
create function test_api.user_by_email(p_email text) returns table (id uuid, email text, meta jsonb) language sql security definer stable as $$
  select u.id, u.email, u.raw_user_meta_data from auth.users u where lower(u.email) = lower(p_email)
$$;
create function test_api.user_by_id(p_id uuid) returns table (id uuid, email text, meta jsonb) language sql security definer stable as $$
  select u.id, u.email, u.raw_user_meta_data from auth.users u where u.id = p_id
$$;
create function test_api.update_user_meta(p_id uuid, p_meta jsonb) returns jsonb language sql security definer as $$
  update auth.users set raw_user_meta_data = raw_user_meta_data || coalesce(p_meta, '{}'::jsonb) where id = p_id returning raw_user_meta_data
$$;
create function test_api.grant_incognito(p_user uuid, p_minutes integer) returns void language sql security definer as $$
  insert into public.incognito_sessions (user_id, ends_at) values (p_user, now() + make_interval(mins => p_minutes))
$$;

revoke all on all functions in schema test_api from public;
grant execute on function test_api.storage_insert(text, text), test_api.storage_can_read(text, text), test_api.storage_delete(text, text), test_api.storage_list(text, text) to authenticated;
grant execute on function test_api.create_user(text, jsonb), test_api.user_by_email(text), test_api.user_by_id(uuid), test_api.update_user_meta(uuid, jsonb), test_api.grant_incognito(uuid, integer) to service_role;

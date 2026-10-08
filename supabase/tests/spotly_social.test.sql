-- Pruebas de la migración spotly_social sobre PostgreSQL local con supabase_stub.sql.
-- Ejecutar: psql -v ON_ERROR_STOP=1 -f supabase_stub.sql -f ../migrations/…spotly_social.sql -f spotly_social.test.sql
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'FALLA: %', label; end if; raise notice 'ok  %', label; end $$;
create function pg_temp.err(stmt text, expected text, label text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if position(expected in sqlerrm) = 0 and sqlstate <> expected then raise exception 'FALLA: % (error inesperado: % %)', label, sqlstate, sqlerrm; end if;
    raise notice 'ok  % (rechazado: %)', label, sqlerrm; return;
  end;
  raise exception 'FALLA: % (debía fallar)', label;
end $$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false); execute 'set role authenticated'; end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', '', false); execute 'set role anon'; end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;

-- ───── Altas: con nombre de usuario (correo) y sin él (Apple/Google)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.test', '{"username":"ana_s","full_name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@example.test', '{"username":"beto"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@example.test', '{"full_name":"Carla"}');
select pg_temp.ok((select count(*) from public.profiles) = 3, 'perfil creado al registrarse');
select pg_temp.ok((select username from public.profiles where id = '00000000-0000-0000-0000-00000000000c') ~ '^u[0-9a-f]{11}$', 'usuario provisional para Apple/Google');
select pg_temp.err($$insert into auth.users (email, raw_user_meta_data) values ('x@example.test', '{"username":"ana_s"}')$$, 'username_taken', 'usuario repetido');
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000d', 'dani@example.test', '{"username":"Mal Nombre"}');
select pg_temp.ok((select username from public.profiles where id = '00000000-0000-0000-0000-00000000000d') ~ '^u[0-9a-f]{11}$', 'usuario inválido → provisional, sin bloquear el alta');

-- Red de seguridad: si falta el perfil, se recrea al entrar
delete from public.profiles where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.ensure_my_profile();
select pg_temp.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = 1, 'ensure_my_profile recrea el perfil que faltaba');

-- ───── Perfil: foto y portada solo de tu carpeta o un fondo de Spotly
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.profiles set city = 'Sevilla', avatar_path = 'perfiles/00000000-0000-0000-0000-00000000000a/foto.jpg', cover = 'preset:aurora' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select avatar_path from public.profiles_public where id = '00000000-0000-0000-0000-00000000000a') like 'perfiles/%', 'foto de perfil propia');
select pg_temp.err($$update public.profiles set avatar_path = 'perfiles/00000000-0000-0000-0000-00000000000b/foto.jpg' where id = '00000000-0000-0000-0000-00000000000a'$$, 'invalid_path', 'no usar la foto de otra persona');
select pg_temp.err($$update public.profiles set cover = 'https://ejemplo.test/x.jpg' where id = '00000000-0000-0000-0000-00000000000a'$$, 'invalid_path', 'portada solo de tu carpeta o un fondo');
select pg_temp.err($$update public.profiles set created_at = now() - interval '9 years' where id = '00000000-0000-0000-0000-00000000000a'$$, 'readonly_fields', 'la fecha de alta no se cambia');
update public.profiles set display_name = 'pirata' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.as_admin();
select pg_temp.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') <> 'pirata', 'no se edita el perfil de otro');

-- ───── Spots
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.spots (id, author_id, title, city, audio_path, duration_ms, peaks) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Concierto en la Alameda', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/s1.webm', 14000, '{0.2,0.5,0.9}');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms) values ('00000000-0000-0000-0000-00000000000b', 'Suplantación', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000b/x.webm', 5000)$$, '42501', 'no publicar en nombre de otro');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms) values ('00000000-0000-0000-0000-00000000000a', 'Voz robada', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000b/x.webm', 5000)$$, 'invalid_path', 'no publicar el audio de otra persona');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms, anon) values ('00000000-0000-0000-0000-00000000000a', 'Anónimo sin pagar', 'Sevilla', 'voces/anon/x.webm', 5000, true)$$, 'incognito_required', 'anónimo exige Incógnito de pago');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms) values ('00000000-0000-0000-0000-00000000000a', 'ab', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/x.webm', 5000)$$, 'check', 'título de al menos 3 letras');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms) values ('00000000-0000-0000-0000-00000000000a', 'Toque accidental', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/x.webm', 300)$$, 'check', 'audio de menos de 0,8 s');
select pg_temp.as_admin();
insert into public.incognito_sessions (user_id, ends_at) values ('00000000-0000-0000-0000-00000000000a', now() + interval '1 hour');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms, anon) values ('00000000-0000-0000-0000-00000000000a', 'Anónimo con mi carpeta', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/x.webm', 5000, true)$$, 'invalid_path', 'lo anónimo no puede ir en tu carpeta (te delataría)');
insert into public.spots (id, author_id, title, city, audio_path, duration_ms, anon, media_path, media_kind) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Cotilleo anónimo', 'Sevilla', 'voces/anon/s2.webm', 9000, true, 'media/anon/f2.jpg', 'photo');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms, anon, visibility) values ('00000000-0000-0000-0000-00000000000a', 'Anónimo para seguidores', 'Sevilla', 'voces/anon/x.webm', 5000, true, 'followers')$$, 'anon_followers', 'anónimo «solo seguidores» no se permite');
insert into public.spots (id, author_id, title, city, audio_path, duration_ms, visibility) values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Solo para seguidores', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/s3.webm', 6000, 'followers'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'Solo para Sevilla', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/s4.webm', 6000, 'nearby');
select pg_temp.err($$update public.spots set views = 999 where id = '10000000-0000-0000-0000-000000000001'$$, 'readonly_fields', 'el autor no puede inflar vistas');
select pg_temp.err($$update public.spots set visibility = 'followers' where id = '10000000-0000-0000-0000-000000000002'$$, 'readonly_fields', 'un anónimo no pasa a «solo seguidores» al editarlo');

select pg_temp.as_anon();
select pg_temp.ok((select count(*) from public.spots_public) = 2, 'sin sesión: solo lo público');
select pg_temp.err($$insert into public.spots (author_id, title, city, audio_path, duration_ms) values ('00000000-0000-0000-0000-00000000000a', 'Sin sesión', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000a/x.webm', 5000)$$, '42501', 'sin sesión no se publica');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.spots) = 0, 'tabla base de Spots solo para su autor');
select pg_temp.ok((select count(*) from public.spots_public) = 2, 'feed: públicos sí; seguidores y otra ciudad no');
select pg_temp.ok((select author_id is null and author_name is null and audio_path like 'voces/anon/%' from public.spots_public where id = '10000000-0000-0000-0000-000000000002'), 'el Spot anónimo no revela autor ni carpeta');
select pg_temp.ok((select author_name = 'Ana' from public.spots_public where id = '10000000-0000-0000-0000-000000000001'), 'el Spot normal lleva nombre');
update public.profiles set city = 'Sevilla' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from public.spots_public) = 3, '«Solo cerca»: lo ve quien es de la misma ciudad');
insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.spots_public) = 4, 'al seguir, ve el Spot para seguidores');
select pg_temp.ok((select followers from public.profiles_public where id = '00000000-0000-0000-0000-00000000000a') = 1, 'contador de seguidores');
select pg_temp.ok((select spots from public.profiles_public where id = '00000000-0000-0000-0000-00000000000a') = 3, 'el contador de Spots no cuenta los anónimos');
select pg_temp.err($$insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a')$$, '42501', 'no seguir en nombre de otro');

-- Vistas: una por persona y día; el autor no cuenta
select pg_temp.ok(public.record_spot_view('10000000-0000-0000-0000-000000000001'), 'primera vista cuenta');
select pg_temp.ok(not public.record_spot_view('10000000-0000-0000-0000-000000000001'), 'segunda vista del día no cuenta');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(not public.record_spot_view('10000000-0000-0000-0000-000000000001'), 'el autor no suma vistas');
select pg_temp.ok((select views from public.spots where id = '10000000-0000-0000-0000-000000000001') = 1, 'vistas = 1');

-- ───── Voces encadenadas en el Spot
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.voice_notes (id, thread_id, author_id, audio_path, duration_ms, peaks) values
  ('20000000-0000-0000-0000-000000000001', 'spot:10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'voces/00000000-0000-0000-0000-00000000000b/v1.webm', 4000, '{0.1,0.4}');
select pg_temp.err($$insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('hot:h1', '00000000-0000-0000-0000-00000000000b', 'voces/00000000-0000-0000-0000-00000000000a/robada.webm', 3000)$$, 'invalid_path', 'no hablar con el audio de otra persona');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.voice_notes (id, thread_id, parent_id, reply_at_ms, author_id, audio_path, duration_ms) values
  ('20000000-0000-0000-0000-000000000002', 'spot:10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1500, '00000000-0000-0000-0000-00000000000a', 'voces/00000000-0000-0000-0000-00000000000a/v2.webm', 3000);
select pg_temp.ok((select parent_id = '20000000-0000-0000-0000-000000000001' and reply_at_ms = 1500 from public.voice_notes_public where id = '20000000-0000-0000-0000-000000000002'), 'respuesta enlazada al segundo exacto');
select pg_temp.err($$insert into public.voice_notes (thread_id, parent_id, author_id, audio_path, duration_ms) values ('hot:h1', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'voces/00000000-0000-0000-0000-00000000000a/x.webm', 3000)$$, 'parent_not_in_thread', 'no responder a una voz de otro hilo');
select pg_temp.err($$insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('texto:libre', '00000000-0000-0000-0000-00000000000a', 'voces/00000000-0000-0000-0000-00000000000a/x.webm', 3000)$$, 'check', 'tipo de hilo desconocido');
update public.spots set replies_allowed = false where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.err($$insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('spot:10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'voces/00000000-0000-0000-0000-00000000000b/x.webm', 3000)$$, 'replies_closed', 'respuestas cerradas por el autor');
select pg_temp.ok((select replies from public.spots_public where id = '10000000-0000-0000-0000-000000000001') = 2, 'contador de respuestas del Spot');
insert into public.voice_likes (note_id, user_id) values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select likes = 1 and liked from public.voice_notes_public where id = '20000000-0000-0000-0000-000000000002'), 'me gusta en una voz');
insert into public.spot_likes (spot_id, user_id) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
insert into public.saved_spots (user_id, spot_id) values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');
select pg_temp.ok((select saved from public.spots_public where id = '10000000-0000-0000-0000-000000000001'), 'guardar un Spot');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.voice_likes) = 0 and (select count(*) from public.spot_likes) = 0, 'los me gusta de otros no se pueden listar');
select pg_temp.ok((select count(*) from public.saved_spots) = 0 and not (select saved from public.spots_public where id = '10000000-0000-0000-0000-000000000001'), 'los guardados son privados');
select pg_temp.ok((select likes from public.spots_public where id = '10000000-0000-0000-0000-000000000001') = 1, 'pero el contador sí se ve');

-- ───── Presentación y muro
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('presentacion:00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'voces/00000000-0000-0000-0000-00000000000a/p.webm', 9000);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.err($$insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('presentacion:00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'voces/00000000-0000-0000-0000-00000000000b/x.webm', 3000)$$, 'not_your_thread', 'no grabar la presentación de otro');
insert into public.voice_notes (id, thread_id, author_id, audio_path, duration_ms) values ('20000000-0000-0000-0000-000000000009', 'muro:00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'voces/00000000-0000-0000-0000-00000000000b/m.webm', 3000);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.err($$select public.delete_voice_note('20000000-0000-0000-0000-000000000009')$$, 'not_allowed', 'un tercero no borra voces de un muro ajeno');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.delete_voice_note('20000000-0000-0000-0000-000000000009'), 'borrado por el dueño del muro');
select pg_temp.as_admin();
select pg_temp.ok((select count(*) from public.voice_notes where id = '20000000-0000-0000-0000-000000000009') = 0, 'el dueño del muro puede borrar lo que le dejan');

-- ───── Chats privados
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t_chat as select public.open_direct_chat('00000000-0000-0000-0000-00000000000b') as id;
grant select on t_chat to authenticated;
select pg_temp.ok((select public.open_direct_chat('00000000-0000-0000-0000-00000000000b')) = (select id from t_chat), 'el chat 1 a 1 se reutiliza');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin execute format('insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values (%L, %L, %L, 4000)', 'chat:' || (select id from t_chat), '00000000-0000-0000-0000-00000000000b', 'chats/' || (select id from t_chat) || '/00000000-0000-0000-0000-00000000000b/c.webm'); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok((select count(*) from public.voice_notes_public where thread_id = 'chat:' || (select id from t_chat)) = 1, 'el otro miembro oye la nota del chat');
select pg_temp.ok((select count(*) from public.my_chats) = 1, 'mis chats');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.voice_notes_public where thread_id = 'chat:' || (select id from t_chat)) = 0, 'quien no es miembro no oye el chat');
select pg_temp.ok((select count(*) from public.thread_events where thread_id = 'chat:' || (select id from t_chat)) = 0, 'ni recibe sus avisos en tiempo real');
select pg_temp.ok((select count(*) from public.thread_events where thread_id like 'spot:%') > 0, 'avisos de hilos públicos visibles');
select pg_temp.ok((select count(*) from public.voice_notes_public where thread_id = 'chat:María') = 0, 'un hilo de chat mal formado no rompe la consulta');
do $$ begin
  begin
    execute format('insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values (%L, %L, %L, 3000)', 'chat:' || (select id from t_chat), '00000000-0000-0000-0000-00000000000c', 'chats/' || (select id from t_chat) || '/00000000-0000-0000-0000-00000000000c/x.webm');
    raise exception 'FALLA: un intruso escribió en un chat';
  exception when others then
    if sqlerrm like 'FALLA%' then raise; end if;
    raise notice 'ok  un intruso no puede hablar en un chat (rechazado: %)', sqlerrm;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t_group as select public.create_group_chat('Comunidad Triana', array['00000000-0000-0000-0000-00000000000b']::uuid[]) as id;
grant select on t_group to authenticated;
select pg_temp.ok(public.am_chat_member((select id from t_group)), 'grupo de voz con varios miembros');
do $$ begin execute format('insert into public.voice_notes (id, thread_id, author_id, anon, audio_path, duration_ms) values (%L, %L, %L, true, %L, 4000)', '20000000-0000-0000-0000-000000000010', 'chat:' || (select id from t_group), '00000000-0000-0000-0000-00000000000a', 'chats/' || (select id from t_group) || '/anon/g.webm'); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select author_id is null and anon from public.voice_notes_public where id = '20000000-0000-0000-0000-000000000010'), 'voz anónima en el grupo: nadie sabe quién habla');
do $$ begin
  begin
    execute format('insert into public.voice_notes (thread_id, author_id, anon, audio_path, duration_ms) values (%L, %L, true, %L, 3000)', 'chat:' || (select id from t_group), '00000000-0000-0000-0000-00000000000b', 'chats/' || (select id from t_group) || '/anon/b.webm');
    raise exception 'FALLA: anónimo sin Incógnito';
  exception when others then
    if sqlerrm like 'FALLA%' then raise; end if;
    if sqlerrm not like '%incognito_required%' then raise exception 'FALLA: error inesperado %', sqlerrm; end if;
    raise notice 'ok  anónimo en un grupo exige Incógnito (rechazado: %)', sqlerrm;
  end;
end $$;

-- ───── Bloqueos (en los dos sentidos)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.spots (id, author_id, title, city, audio_path, duration_ms) values
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000c', 'Spot de Carla', 'Sevilla', 'voces/00000000-0000-0000-0000-00000000000c/s5.webm', 5000);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
select pg_temp.err($$select public.open_direct_chat('00000000-0000-0000-0000-00000000000c')$$, 'blocked', 'sin chat con quien has bloqueado');
select pg_temp.ok((select count(*) from public.spots_public where id = '10000000-0000-0000-0000-000000000005') = 0, 'no ves los Spots de quien bloqueas');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.err($$select public.open_direct_chat('00000000-0000-0000-0000-00000000000a')$$, 'blocked', 'sin chat con quien te ha bloqueado');
select pg_temp.ok((select count(*) from public.spots_public where author_id = '00000000-0000-0000-0000-00000000000a' or id = '10000000-0000-0000-0000-000000000002') = 0, 'quien te bloquea desaparece para ti (también lo anónimo)');
select pg_temp.err($$insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('muro:00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'voces/00000000-0000-0000-0000-00000000000c/x.webm', 3000)$$, 'blocked', 'no dejar voces en el muro de quien te bloqueó');
select pg_temp.err($$insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a')$$, '42501', 'no seguir a quien te bloqueó');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.follows where follower_id = '00000000-0000-0000-0000-00000000000b' and followee_id = '00000000-0000-0000-0000-00000000000c') = 0, 'al bloquear, quien te seguía deja de seguirte');

-- ───── Denuncias
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000000b', 'spot', '10000000-0000-0000-0000-000000000002', 'Acoso o insultos');
select pg_temp.err($$insert into public.reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000000b', 'spot', '10000000-0000-0000-0000-000000000002', 'Spam')$$, 'unique', 'una denuncia por persona y contenido');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.reports) = 0, 'las denuncias de otros no se ven');

-- ───── Almacenamiento
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('voces', '00000000-0000-0000-0000-00000000000a/ok.webm');
insert into storage.objects (bucket_id, name) values ('voces', 'anon/ok2.webm');
insert into storage.objects (bucket_id, name) values ('media', 'anon/ok3.jpg');
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('voces', '00000000-0000-0000-0000-00000000000b/mal.webm')$$, 'row-level security', 'no subir a la carpeta de otro');
select pg_temp.err($$insert into storage.objects (bucket_id, name) values ('perfiles', 'anon/mal.jpg')$$, 'row-level security', 'la foto de perfil nunca es anónima');
do $$ begin execute format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chats', (select id from t_chat) || '/00000000-0000-0000-0000-00000000000a/c.webm'); end $$;
do $$ begin execute format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chats', (select id from t_group) || '/anon/g.webm'); end $$;
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'chats') = 2, 'los miembros ven el audio de sus chats');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    execute format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'chats', (select id from t_chat) || '/00000000-0000-0000-0000-00000000000c/x.webm');
    raise exception 'FALLA: un intruso subió audio a un chat';
  exception when others then
    if sqlerrm like 'FALLA%' then raise; end if;
    raise notice 'ok  no se sube audio a chats ajenos (rechazado: %)', sqlerrm;
  end;
end $$;
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'chats') = 0, 'el audio de un chat solo lo leen sus miembros');
do $$ declare n int; begin with d as (delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/ok.webm' returning 1) select count(*) into n from d; perform pg_temp.ok(n = 0, 'no se borran archivos ajenos'); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare n int; begin with d as (delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/ok.webm' returning 1) select count(*) into n from d; perform pg_temp.ok(n = 1, 'cada cual borra sus archivos'); end $$;

-- ───── Antiavalanchas: 20 voces por minuto
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  for i in 1..20 loop
    insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('hot:h1', '00000000-0000-0000-0000-00000000000d', 'voces/00000000-0000-0000-0000-00000000000d/r' || i || '.webm', 1000);
  end loop;
end $$;
select pg_temp.err($$insert into public.voice_notes (thread_id, author_id, audio_path, duration_ms) values ('hot:h1', '00000000-0000-0000-0000-00000000000d', 'voces/00000000-0000-0000-0000-00000000000d/r21.webm', 1000)$$, 'rate_limited', 'límite de voces por minuto');

-- ───── Borrar mi cuenta (App Store / Google Play)
select pg_temp.ok(public.delete_my_account(), 'borrar mi cuenta');
select pg_temp.as_admin();
select pg_temp.ok((select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000d') = 0, 'la cuenta desaparece');
select pg_temp.ok((select count(*) from public.voice_notes where author_id = '00000000-0000-0000-0000-00000000000d') = 0, 'y con ella sus voces');
select pg_temp.ok((select count(*) from public.account_deletions) = 0, 'sin rastro de la solicitud cuando se borra al momento');

select 'SPOTLY_SQL_TESTS_OK' as resultado;

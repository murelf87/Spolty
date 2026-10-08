-- Spotly · red social de voz (Lovable Cloud / Supabase)
-- Perfiles, Spots, voces encadenadas, me gusta, seguidores, vistas, chats 1 a 1 y de grupo, denuncias, bloqueos,
-- Incógnito y borrado de cuenta. Todo el contenido de usuario es voz: el único texto libre es el título del Spot
-- (y nombre/usuario/título de grupo).
--
-- Privacidad del Incógnito: las tablas base solo se leen por su autor; el público lee a través de las vistas
-- *_public, que ocultan quién habla cuando la voz o el Spot son anónimos (también la ruta del audio: va a anon/).
-- El tiempo real se hace con thread_events, que no lleva datos personales: el cliente recibe el aviso y vuelve a
-- pedir la conversación por la vista.

-- ─────────────────────────────── Perfiles ───────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_.]{2,19}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  city text not null default '' check (char_length(city) <= 80),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  cover text check (cover is null or char_length(cover) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Perfil público. La presentación es una voz (voice_notes con thread presentacion:<id>).';

-- Usuario provisional único para quien entra con Apple/Google o no eligió uno válido (editable después).
create or replace function public.provisional_username(uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare hex text := replace(uid::text, '-', ''); cand text;
begin
  for i in 0..20 loop
    cand := 'u' || case when i = 0 then substr(hex, 1, 11) when i = 1 then substr(hex, 12, 11) else substr(md5(hex || i::text), 1, 11) end;
    if not exists (select 1 from public.profiles where username = cand) then return cand; end if;
  end loop;
  raise exception 'username_unavailable' using errcode = '23505';
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  uname text;
begin
  if wanted ~ '^[a-z][a-z0-9_.]{2,19}$' then
    if exists (select 1 from public.profiles where username = wanted) then raise exception 'username_taken' using errcode = '23505'; end if;
    uname := wanted;
  else
    uname := public.provisional_username(new.id);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', nullif(wanted, ''), ''), 40));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Cuentas creadas antes de esta migración: se les crea su perfil.
do $$
declare u record; wanted text;
begin
  for u in select a.id, a.raw_user_meta_data as m from auth.users a where not exists (select 1 from public.profiles p where p.id = a.id) order by a.created_at loop
    wanted := lower(coalesce(u.m ->> 'username', ''));
    if wanted !~ '^[a-z][a-z0-9_.]{2,19}$' or exists (select 1 from public.profiles where username = wanted) then wanted := public.provisional_username(u.id); end if;
    insert into public.profiles (id, username, display_name)
    values (u.id, wanted, left(coalesce(u.m ->> 'full_name', u.m ->> 'name', u.m ->> 'username', ''), 40)) on conflict (id) do nothing;
  end loop;
end $$;

-- Red de seguridad: crea tu perfil si por cualquier motivo no existe (la app lo llama al entrar).
create or replace function public.ensure_my_profile()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m jsonb; wanted text;
begin
  if me is null or exists (select 1 from public.profiles where id = me) then return; end if;
  select raw_user_meta_data into m from auth.users where id = me;
  if not found then return; end if;
  wanted := lower(coalesce(m ->> 'username', ''));
  if wanted !~ '^[a-z][a-z0-9_.]{2,19}$' or exists (select 1 from public.profiles where username = wanted) then wanted := public.provisional_username(me); end if;
  insert into public.profiles (id, username, display_name)
  values (me, wanted, left(coalesce(m ->> 'full_name', m ->> 'name', m ->> 'username', ''), 40)) on conflict (id) do nothing;
end $$;

-- La foto y la portada solo pueden apuntar a tu carpeta (o a un fondo de Spotly); id y fecha de alta no cambian.
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.created_at <> old.created_at) then raise exception 'readonly_fields' using errcode = '42501'; end if;
  if new.avatar_path is not null and new.avatar_path !~ ('^perfiles/' || new.id::text || '/[A-Za-z0-9._-]{1,100}$') then raise exception 'invalid_path' using errcode = '22023'; end if;
  if new.cover is not null and new.cover !~ '^preset:[a-z]{1,20}$' and new.cover !~ ('^perfiles/' || new.id::text || '/[A-Za-z0-9._-]{1,100}$') then raise exception 'invalid_path' using errcode = '22023'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before insert or update on public.profiles for each row execute function public.profiles_guard();

-- ─────────────────────────────── Roles de moderación ───────────────────────────────
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  primary key (user_id, role)
);
-- Las funciones de ayuda responden solo sobre quien pregunta (auth.uid()): las usan las políticas, así que se pueden
-- llamar por RPC, pero nunca revelan nada de terceros (si alguien es moderador, tiene Incógnito o bloqueó a otro).
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.user_roles where user_id = auth.uid())
$$;

-- ─────────────────────────────── Incógnito (pagado) ───────────────────────────────
-- Solo se escribe desde el servidor (webhook de pagos/IAP con la service role). Sin sesión activa no se puede
-- publicar como «Anónimo».
create table public.incognito_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source text not null default 'purchase' check (char_length(source) <= 40),
  created_at timestamptz not null default now()
);
create index incognito_sessions_user on public.incognito_sessions (user_id, starts_at desc);
create or replace function public.has_incognito()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.incognito_sessions s where s.user_id = auth.uid() and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now()))
$$;

-- ─────────────────────────────── Bloqueos y seguidores ───────────────────────────────
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked on public.blocks (blocked_id);
-- ¿Hay un bloqueo entre tú y esta persona (en cualquier sentido)?
create or replace function public.has_block_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and other is not null and exists (select 1 from public.blocks where (blocker_id = auth.uid() and blocked_id = other) or (blocker_id = other and blocked_id = auth.uid()))
$$;

-- Al bloquear, se deja de seguir en los dos sentidos.
create or replace function public.blocks_unfollow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return null;
end $$;

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id);
create trigger blocks_unfollow after insert on public.blocks for each row execute function public.blocks_unfollow();

-- ─────────────────────────────── Spots ───────────────────────────────
-- visibility: public (todos) · nearby (solo quien tiene tu misma ciudad en su perfil) · followers (tus seguidores).
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  city text not null check (char_length(city) between 1 and 80),
  zone text not null default '' check (char_length(zone) <= 80),
  topic text not null default '' check (char_length(topic) <= 40),
  visibility text not null default 'public' check (visibility in ('public', 'nearby', 'followers')),
  location_hidden boolean not null default false,
  anon boolean not null default false,
  happening_now boolean not null default true,
  replies_allowed boolean not null default true,
  audio_path text not null check (char_length(audio_path) <= 300),
  duration_ms integer not null check (duration_ms between 800 and 300000),
  peaks real[] not null default '{}' check (coalesce(array_length(peaks, 1), 0) <= 128),
  media_path text check (media_path is null or char_length(media_path) <= 300),
  media_kind text check (media_kind in ('photo', 'video')),
  views integer not null default 0 check (views >= 0),
  status text not null default 'published' check (status in ('published', 'review', 'removed')),
  created_at timestamptz not null default now(),
  check ((media_path is null) = (media_kind is null))
);
create index spots_feed on public.spots (created_at desc) where status = 'published';
create index spots_city_feed on public.spots (city, created_at desc) where status = 'published';
create index spots_author on public.spots (author_id, created_at desc);

create table public.spot_likes (
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spot_id, user_id)
);
create index spot_likes_user on public.spot_likes (user_id);

-- Guardados: tus Spots marcados para escuchar luego (solo los ves tú).
create table public.saved_spots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  spot_id uuid not null references public.spots (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);
create index saved_spots_user on public.saved_spots (user_id, created_at desc);

-- Vistas: una por persona, Spot y día; las del autor no cuentan.
create table public.spot_views (
  spot_id uuid not null references public.spots (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  primary key (spot_id, viewer_id, day)
);
create or replace function public.record_spot_view(p_spot uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); author uuid; inserted int;
begin
  if me is null then return false; end if;
  select s.author_id into author from public.spots s where s.id = p_spot and s.status = 'published';
  if author is null or author = me then return false; end if;
  insert into public.spot_views (spot_id, viewer_id) values (p_spot, me) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    perform set_config('spotly.trusted_update', 'on', true);
    update public.spots set views = views + 1 where id = p_spot;
    perform set_config('spotly.trusted_update', 'off', true);
  end if;
  return inserted > 0;
end $$;

-- ─────────────────────────────── Chats de voz ───────────────────────────────
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text not null default '' check (char_length(title) <= 60),
  -- Si quien creó el grupo borra su cuenta, el grupo sigue para los demás.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user on public.chat_members (user_id);
create or replace function public.am_chat_member(p_chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.chat_members m where m.chat_id = p_chat and m.user_id = auth.uid())
$$;

-- Abre (o reutiliza) el chat 1 a 1 con otra persona; nunca si hay un bloqueo entre las dos.
create or replace function public.open_direct_chat(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); found uuid;
begin
  if me is null or p_other is null or p_other = me then raise exception 'invalid_chat' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_other) then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  if public.has_block_with(p_other) then raise exception 'blocked' using errcode = '42501'; end if;
  select c.id into found from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = me
    join public.chat_members b on b.chat_id = c.id and b.user_id = p_other
   where not c.is_group limit 1;
  if found is not null then return found; end if;
  insert into public.chats (is_group, created_by) values (false, me) returning id into found;
  insert into public.chat_members (chat_id, user_id) values (found, me), (found, p_other);
  return found;
end $$;

-- Crea un grupo de voz con sus miembros iniciales (todos pueden hablar). No añade a quien está bloqueado contigo.
create or replace function public.create_group_chat(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then raise exception 'invalid_title' using errcode = '22023'; end if;
  if coalesce(array_length(p_members, 1), 0) > 100 then raise exception 'too_many_members' using errcode = '22023'; end if;
  insert into public.chats (is_group, title, created_by) values (true, btrim(p_title), me) returning id into cid;
  insert into public.chat_members (chat_id, user_id)
    select cid, x.u from (select me as u union select unnest(coalesce(p_members, '{}'::uuid[]))) x
    where exists (select 1 from public.profiles p where p.id = x.u) and (x.u = me or not public.has_block_with(x.u))
  on conflict do nothing;
  return cid;
end $$;

-- ─────────────────────────────── Voces (todas las conversaciones) ───────────────────────────────
-- thread_id: spot:<uuid> · photo:<id> · hot:<id> · group:<nombre> · event:<nombre> · muro:<user_id> ·
--            presentacion:<user_id> · chat:<uuid> · soporte:<user_id>
create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null check (thread_id ~ '^(spot|photo|hot|group|event|muro|presentacion|chat|soporte):.{1,120}$'),
  parent_id uuid references public.voice_notes (id) on delete set null,
  reply_at_ms integer check (reply_at_ms is null or reply_at_ms between 0 and 3600000),
  author_id uuid not null references public.profiles (id) on delete cascade,
  anon boolean not null default false,
  audio_path text not null check (char_length(audio_path) <= 300),
  duration_ms integer not null check (duration_ms between 800 and 300000),
  peaks real[] not null default '{}' check (coalesce(array_length(peaks, 1), 0) <= 128),
  status text not null default 'published' check (status in ('published', 'review', 'removed')),
  created_at timestamptz not null default now()
);
create index voice_notes_thread on public.voice_notes (thread_id, created_at);
create index voice_notes_author on public.voice_notes (author_id, created_at desc);
create index voice_notes_parent on public.voice_notes (parent_id);

create table public.voice_likes (
  note_id uuid not null references public.voice_notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index voice_likes_user on public.voice_likes (user_id);

-- ¿Puede esta persona leer el hilo? Los chats, solo sus miembros; el soporte, solo su dueño y moderación.
create or replace function public.can_read_thread(p_thread text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_thread like 'chat:%' then substr(p_thread, 6) ~ '^[0-9a-f-]{36}$' and public.am_chat_member(substr(p_thread, 6)::uuid)
    when p_thread like 'soporte:%' then auth.uid() is not null and (substr(p_thread, 9) = auth.uid()::text or public.is_moderator())
    else true end
$$;

-- Reglas de escritura: autor = quien envía, hilo permitido, respuestas solo dentro del mismo hilo, Incógnito pagado,
-- sin hablar donde te han bloqueado, el audio en tu carpeta (o en anon/ si es anónimo) y sin avalanchas.
create or replace function public.voice_notes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_owner uuid; spot_ok boolean; chat_id text; prefix text;
begin
  if new.author_id is distinct from auth.uid() then raise exception 'author_mismatch' using errcode = '42501'; end if;
  if (select count(*) from public.voice_notes v where v.author_id = new.author_id and v.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if new.thread_id like 'presentacion:%' or new.thread_id like 'soporte:%' then
    if split_part(new.thread_id, ':', 2) <> new.author_id::text then raise exception 'not_your_thread' using errcode = '42501'; end if;
    new.anon := false;
  end if;
  if new.anon and not public.has_incognito() then raise exception 'incognito_required' using errcode = '42501'; end if;
  if new.thread_id like 'chat:%' then
    chat_id := substr(new.thread_id, 6);
    if chat_id !~ '^[0-9a-f-]{36}$' or not public.am_chat_member(chat_id::uuid) then raise exception 'not_a_member' using errcode = '42501'; end if;
    prefix := 'chats/' || chat_id || '/' || case when new.anon then 'anon' else new.author_id::text end || '/';
  else
    prefix := 'voces/' || case when new.anon then 'anon' else new.author_id::text end || '/';
    if new.thread_id like 'muro:%' then
      target_owner := case when substr(new.thread_id, 6) ~ '^[0-9a-f-]{36}$' then substr(new.thread_id, 6)::uuid end;
      if public.has_block_with(target_owner) then raise exception 'blocked' using errcode = '42501'; end if;
    elsif new.thread_id like 'spot:%' then
      select s.replies_allowed, s.author_id into spot_ok, target_owner from public.spots s where s.id::text = substr(new.thread_id, 6) and s.status = 'published';
      if spot_ok is distinct from true then raise exception 'replies_closed' using errcode = '42501'; end if;
      if public.has_block_with(target_owner) then raise exception 'blocked' using errcode = '42501'; end if;
    end if;
  end if;
  if left(new.audio_path, char_length(prefix)) <> prefix or substr(new.audio_path, char_length(prefix) + 1) !~ '^[A-Za-z0-9._-]{1,100}$' then
    raise exception 'invalid_path' using errcode = '22023';
  end if;
  if new.parent_id is not null and not exists (select 1 from public.voice_notes p where p.id = new.parent_id and p.thread_id = new.thread_id) then
    raise exception 'parent_not_in_thread' using errcode = '22023';
  end if;
  new.status := 'published';
  new.created_at := now();
  return new;
end $$;
create trigger voice_notes_guard before insert on public.voice_notes for each row execute function public.voice_notes_guard();

create or replace function public.spots_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare folder text;
begin
  if new.author_id is distinct from auth.uid() then raise exception 'author_mismatch' using errcode = '42501'; end if;
  if (select count(*) from public.spots s where s.author_id = new.author_id and s.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if new.anon and not public.has_incognito() then raise exception 'incognito_required' using errcode = '42501'; end if;
  -- Un Spot anónimo «solo para seguidores» delataría a su autor ante quien sigue a poca gente.
  if new.anon and new.visibility = 'followers' then raise exception 'anon_followers' using errcode = '22023'; end if;
  folder := case when new.anon then 'anon' else new.author_id::text end;
  if new.audio_path !~ ('^voces/' || folder || '/[A-Za-z0-9._-]{1,100}$') then raise exception 'invalid_path' using errcode = '22023'; end if;
  if new.media_path is not null and new.media_path !~ ('^media/' || folder || '/[A-Za-z0-9._-]{1,100}$') then raise exception 'invalid_path' using errcode = '22023'; end if;
  new.views := 0; new.status := 'published'; new.created_at := now();
  return new;
end $$;
create trigger spots_guard before insert on public.spots for each row execute function public.spots_guard();

-- Al editar, el autor solo puede cambiar ajustes de conversación; vistas y moderación no se tocan desde el cliente.
create or replace function public.spots_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_moderator() or current_setting('spotly.trusted_update', true) = 'on' then return new; end if;
  if new.author_id <> old.author_id or new.views <> old.views or new.status <> old.status or new.audio_path <> old.audio_path
     or new.media_path is distinct from old.media_path or new.created_at <> old.created_at or new.anon <> old.anon
     or (new.anon and new.visibility = 'followers') then
    raise exception 'readonly_fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger spots_update_guard before update on public.spots for each row execute function public.spots_update_guard();

-- Avisos de tiempo real sin datos personales: «hay voces nuevas en este hilo».
create table public.thread_events (
  id bigint generated always as identity primary key,
  thread_id text not null,
  created_at timestamptz not null default now()
);
create index thread_events_thread on public.thread_events (thread_id, id desc);
create index thread_events_created on public.thread_events (created_at);
create or replace function public.voice_notes_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.thread_events (thread_id) values (case when tg_op = 'DELETE' then old.thread_id else new.thread_id end);
  delete from public.thread_events where created_at < now() - interval '2 days';
  return null;
end $$;
create trigger voice_notes_event after insert or update or delete on public.voice_notes for each row execute function public.voice_notes_event();

-- Borrar una voz: su autor, el dueño del muro donde la dejaron (sin revelarle quién era si fue anónima) o moderación.
create or replace function public.delete_voice_note(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.voice_notes%rowtype;
begin
  select * into n from public.voice_notes where id = p_id;
  if not found or me is null then return false; end if;
  if n.author_id = me or n.thread_id = 'muro:' || me::text or public.is_moderator() then
    delete from public.voice_notes where id = p_id;
    return true;
  end if;
  raise exception 'not_allowed' using errcode = '42501';
end $$;

-- ─────────────────────────────── Denuncias ───────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('spot', 'voice', 'profile', 'chat')),
  target_id text not null check (char_length(target_id) <= 120),
  reason text not null check (char_length(reason) between 3 and 60),
  status text not null default 'review' check (status in ('review', 'resolved', 'removed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- ─────────────────────────────── Borrar mi cuenta ───────────────────────────────
-- Exigido por App Store y Google Play. Queda constancia de la solicitud; si el servidor permite borrar al momento,
-- se borra la cuenta (y en cascada su perfil, Spots, voces, seguidores, chats y me gusta) y se devuelve true.
create table public.account_deletions (
  user_id uuid primary key,
  requested_at timestamptz not null default now()
);
create or replace function public.delete_my_account()
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  insert into public.account_deletions (user_id) values (me) on conflict (user_id) do update set requested_at = now();
  begin
    delete from auth.users where id = me;
    delete from public.account_deletions where user_id = me;
    return true;
  exception when insufficient_privilege or foreign_key_violation then
    return false;
  end;
end $$;

-- ─────────────────────────────── Vistas públicas (ocultan al autor anónimo) ───────────────────────────────
create view public.profiles_public with (security_barrier = true) as
select p.id, p.username, p.display_name, p.city, p.avatar_path, p.cover, p.created_at,
  (select count(*) from public.follows f where f.followee_id = p.id)::int as followers,
  (select count(*) from public.follows f where f.follower_id = p.id)::int as following,
  (select count(*) from public.spots s where s.author_id = p.id and s.status = 'published' and not s.anon)::int as spots
from public.profiles p;

create view public.spots_public with (security_barrier = true) as
select s.id,
  case when s.anon and s.author_id is distinct from auth.uid() then null else s.author_id end as author_id,
  case when s.anon and s.author_id is distinct from auth.uid() then null else p.display_name end as author_name,
  case when s.anon and s.author_id is distinct from auth.uid() then null else p.username end as author_username,
  case when s.anon and s.author_id is distinct from auth.uid() then null else p.avatar_path end as author_avatar,
  s.anon, s.author_id = auth.uid() as mine,
  s.title, s.city, case when s.location_hidden then '' else s.zone end as zone, s.topic, s.visibility, s.location_hidden,
  s.happening_now, s.replies_allowed, s.audio_path, s.duration_ms, s.peaks, s.media_path, s.media_kind, s.views, s.created_at,
  (select count(*) from public.spot_likes l where l.spot_id = s.id)::int as likes,
  exists (select 1 from public.spot_likes l where l.spot_id = s.id and l.user_id = auth.uid()) as liked,
  (select count(*) from public.voice_notes v where v.thread_id = 'spot:' || s.id and v.status = 'published')::int as replies,
  exists (select 1 from public.saved_spots g where g.spot_id = s.id and g.user_id = auth.uid()) as saved
from public.spots s join public.profiles p on p.id = s.author_id
where (s.status = 'published' or s.author_id = auth.uid())
  and (s.visibility <> 'followers' or s.author_id = auth.uid() or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = s.author_id))
  and (s.visibility <> 'nearby' or s.author_id = auth.uid() or s.city = (select v.city from public.profiles v where v.id = auth.uid()))
  and not public.has_block_with(s.author_id);

create view public.voice_notes_public with (security_barrier = true) as
select v.id, v.thread_id, v.parent_id, v.reply_at_ms,
  case when v.anon and v.author_id is distinct from auth.uid() then null else v.author_id end as author_id,
  case when v.anon and v.author_id is distinct from auth.uid() then null else p.display_name end as author_name,
  case when v.anon and v.author_id is distinct from auth.uid() then null else p.username end as author_username,
  case when v.anon and v.author_id is distinct from auth.uid() then null else p.avatar_path end as author_avatar,
  v.anon, v.author_id = auth.uid() as mine, v.audio_path, v.duration_ms, v.peaks, v.created_at,
  (select count(*) from public.voice_likes l where l.note_id = v.id)::int as likes,
  exists (select 1 from public.voice_likes l where l.note_id = v.id and l.user_id = auth.uid()) as liked
from public.voice_notes v join public.profiles p on p.id = v.author_id
where (v.status = 'published' or v.author_id = auth.uid())
  and public.can_read_thread(v.thread_id)
  and not public.has_block_with(v.author_id);

-- Mis chats con el último movimiento.
create view public.my_chats with (security_barrier = true) as
select c.id, c.is_group, c.title, c.created_at,
  (select coalesce(array_agg(json_build_object('id', p.id, 'name', p.display_name, 'username', p.username, 'avatar', p.avatar_path)), '{}')
     from public.chat_members m join public.profiles p on p.id = m.user_id where m.chat_id = c.id and m.user_id <> auth.uid()) as members,
  (select max(v.created_at) from public.voice_notes v where v.thread_id = 'chat:' || c.id) as last_at
from public.chats c
where public.am_chat_member(c.id);

-- ─────────────────────────────── Seguridad a nivel de fila ───────────────────────────────
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.incognito_sessions enable row level security;
alter table public.blocks enable row level security;
alter table public.follows enable row level security;
alter table public.spots enable row level security;
alter table public.spot_likes enable row level security;
alter table public.spot_views enable row level security;
alter table public.saved_spots enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.voice_notes enable row level security;
alter table public.voice_likes enable row level security;
alter table public.thread_events enable row level security;
alter table public.reports enable row level security;
alter table public.account_deletions enable row level security;

create policy "perfiles visibles" on public.profiles for select using (true);
create policy "editar mi perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "ver mis roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create policy "ver mi incognito" on public.incognito_sessions for select to authenticated using (user_id = auth.uid());

create policy "mis bloqueos" on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy "bloquear" on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "desbloquear" on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create policy "seguidores visibles" on public.follows for select using (true);
create policy "seguir" on public.follows for insert to authenticated with check (follower_id = auth.uid() and not public.has_block_with(followee_id));
create policy "dejar de seguir" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Spots: la tabla base solo la lee su autor (o moderación); el resto, por spots_public.
create policy "mis spots" on public.spots for select to authenticated using (author_id = auth.uid() or public.is_moderator());
create policy "publicar spot" on public.spots for insert to authenticated with check (author_id = auth.uid());
create policy "editar mi spot" on public.spots for update to authenticated using (author_id = auth.uid() or public.is_moderator());
create policy "borrar mi spot" on public.spots for delete to authenticated using (author_id = auth.uid() or public.is_moderator());

-- Los me gusta solo los ve quien los dio (los contadores salen de las vistas).
create policy "mis me gusta" on public.spot_likes for select to authenticated using (user_id = auth.uid());
create policy "dar me gusta" on public.spot_likes for insert to authenticated with check (user_id = auth.uid());
create policy "quitar me gusta" on public.spot_likes for delete to authenticated using (user_id = auth.uid());

create policy "mis vistas" on public.spot_views for select to authenticated using (viewer_id = auth.uid());

create policy "mis guardados" on public.saved_spots for select to authenticated using (user_id = auth.uid());
create policy "guardar un spot" on public.saved_spots for insert to authenticated with check (user_id = auth.uid());
create policy "quitar de guardados" on public.saved_spots for delete to authenticated using (user_id = auth.uid());

create policy "mis chats" on public.chats for select to authenticated using (public.am_chat_member(id));
create policy "miembros de mis chats" on public.chat_members for select to authenticated using (public.am_chat_member(chat_id));
create policy "salir de un chat" on public.chat_members for delete to authenticated using (user_id = auth.uid());

create policy "mis voces" on public.voice_notes for select to authenticated using (author_id = auth.uid() or public.is_moderator());
create policy "enviar voz" on public.voice_notes for insert to authenticated with check (author_id = auth.uid());
create policy "borrar mi voz" on public.voice_notes for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());

create policy "mis me gusta de voces" on public.voice_likes for select to authenticated using (user_id = auth.uid());
create policy "dar me gusta a una voz" on public.voice_likes for insert to authenticated with check (user_id = auth.uid());
create policy "quitar me gusta a una voz" on public.voice_likes for delete to authenticated using (user_id = auth.uid());

create policy "avisos de hilos legibles" on public.thread_events for select using (public.can_read_thread(thread_id));

create policy "denunciar" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "mis denuncias" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_moderator());
create policy "moderar denuncias" on public.reports for update to authenticated using (public.is_moderator());

create policy "mi solicitud de borrado" on public.account_deletions for select to authenticated using (user_id = auth.uid());

grant select on public.profiles_public, public.spots_public, public.voice_notes_public to anon, authenticated;
grant select on public.my_chats to authenticated;
revoke all on function public.delete_voice_note(uuid) from public;
grant execute on function public.delete_voice_note(uuid) to authenticated;
revoke all on function public.record_spot_view(uuid) from public;
grant execute on function public.record_spot_view(uuid) to authenticated;
revoke all on function public.open_direct_chat(uuid) from public;
grant execute on function public.open_direct_chat(uuid) to authenticated;
revoke all on function public.create_group_chat(text, uuid[]) from public;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;
revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.provisional_username(uuid) from public;

-- ─────────────────────────────── Tiempo real ───────────────────────────────
alter publication supabase_realtime add table public.thread_events;

-- ─────────────────────────────── Almacenamiento ───────────────────────────────
-- voces (audio de Spots y voces públicas), media (fotos y vídeos de Spots), perfiles (avatar y portada): lectura
-- pública con rutas imposibles de adivinar; escritura solo en tu carpeta <user_id>/… Lo anónimo va a anon/<aleatorio>
-- para que la ruta no delate a nadie. Los chats son privados: chats/<chat_id>/<user_id|anon>/… solo sus miembros.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('voces', 'voces', true, 10485760, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a']),
  ('media', 'media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('perfiles', 'perfiles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('chats', 'chats', false, 10485760, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a'])
on conflict (id) do nothing;

create policy "subir a mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id in ('voces', 'media', 'perfiles') and ((storage.foldername(name))[1] = auth.uid()::text or (bucket_id in ('voces', 'media') and (storage.foldername(name))[1] = 'anon')));
create policy "ver mis archivos" on storage.objects for select to authenticated
  using (bucket_id in ('voces', 'media', 'perfiles') and owner_id = auth.uid()::text);
create policy "borrar mis archivos" on storage.objects for delete to authenticated
  using (bucket_id in ('voces', 'media', 'perfiles', 'chats') and owner_id = auth.uid()::text);
create policy "leer audio de mis chats" on storage.objects for select to authenticated
  using (bucket_id = 'chats' and public.am_chat_member(((storage.foldername(name))[1])::uuid));
create policy "enviar audio a mis chats" on storage.objects for insert to authenticated
  with check (bucket_id = 'chats' and public.am_chat_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] in (auth.uid()::text, 'anon'));

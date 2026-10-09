# Activar la nube de Spotly en Lovable Cloud

Hasta que hagas esto, Spotly funciona en cada móvil por separado: lo que publicas se guarda solo en ese dispositivo.
Con la nube activada, iPhone, Android y la web comparten las mismas cuentas, Spots, voces, seguidores, chats,
historias, guardados, comunidades y eventos.

Se hace **una sola vez** y no borra nada: la base de datos de Lovable Cloud de este proyecto está vacía (no hay tablas
en `src/integrations/supabase/types.ts`) y la migración crea todo de cero.

## Qué crea la migración

`supabase/migrations/20261008140000_spotly_social.sql`:

- **Tablas**: perfiles, roles de moderación, Incógnito, bloqueos, seguidores, Spots, me gusta, guardados, vistas,
  historias, chats (1 a 1 y de grupo), voces encadenadas (respuestas a respuestas), me gusta de voces, avisos de tiempo
  real, comunidades, eventos, denuncias y solicitudes de borrado de cuenta.
- **Seguridad (RLS)** en todas las tablas: cada persona solo escribe lo suyo; lo anónimo se lee a través de vistas
  `*_public` que ocultan al autor; límites de ritmo contra el spam; el único texto libre es el título.
- **Almacenamiento**: `voces` y `media` (públicos con rutas imposibles de adivinar), `perfiles` (foto y portada) y
  `chats` (privado, solo sus miembros).
- **Tiempo real**: la tabla `thread_events` (avisos sin datos personales).

Está probada en local contra PostgreSQL 16 y PostgREST 14 (97 comprobaciones SQL, 75 de API y una prueba de dos
personas en el navegador). **No se ha podido ejecutar todavía en el servidor real de Lovable Cloud**: ese es el paso
que haces tú.

## Paso 1 · Comprueba que Lovable tiene la última versión

En Lovable, abre el proyecto conectado a GitHub (`murelf87/Spolty`) y comprueba en el historial que aparece el último
commit de `main`. El archivo de la migración tiene que estar en `supabase/migrations/`.

## Paso 2 · Ejecuta la migración (elige una opción)

**Opción A · Editor SQL (exacta, recomendada)**

1. En Lovable: **More (Más) → Cloud → SQL editor**.
2. Abre `supabase/migrations/20261008140000_spotly_social.sql` en GitHub, pulsa **Raw**, selecciona todo y cópialo.
3. Pégalo en el editor y pulsa **Run** (o Ctrl/⌘ + Enter).
4. Debe terminar sin errores. Si Lovable te pide confirmar, acepta (la migración no borra nada).

**Opción B · Chat de Lovable**

Escribe en el chat del proyecto:

> Aplica en Lovable Cloud, sin cambiar nada, el SQL del archivo `supabase/migrations/20261008140000_spotly_social.sql`
> del repositorio. No toques el código de la app.

Revisa el SQL que te enseñe y apruébalo. Lovable puede guardar una copia de la migración con otra fecha o regenerar
`src/integrations/supabase/types.ts`: es normal y la app sigue funcionando igual.

> No la ejecutes dos veces: la segunda vez fallaría con «already exists». No rompe nada, pero no hace falta.

## Paso 3 · Comprueba que ha funcionado

En el editor SQL:

```sql
select count(*) from public.profiles;          -- responde un número (0 o más), no un error
select id from storage.buckets order by id;    -- chats, media, perfiles, voces
```

En la app publicada, entra con una cuenta (correo, Apple o Google) y abre **Perfil → Ajustes**. Debajo de «Sesión
iniciada» verás:

- «Tus Spots, voces y chats están en la nube…» → **activada**.
- «La nube de Spotly aún no está activada…» → la migración no se ha aplicado (vuelve al paso 2).
- «Sin conexión con la nube…» → problema de red o del servidor; la app lo reintenta sola.

Prueba de verdad: con dos cuentas en dos móviles, publica un Spot con una y respóndele con tu voz desde la otra.

## Paso 4 · Ajustes de acceso (Cloud → Users)

- **Correo**: confirmación de correo activada y contraseña mínima de 8 caracteres. La app pide el **código de 6
  cifras**, así que la plantilla «Confirm signup» tiene que incluir `{{ .Token }}` además del enlace.
- **Apple y Google**: ya están activados para la web. En las apps nativas aún no (ver `docs/APPS_NATIVAS.md`).
- **URL del sitio**: la de la web publicada (y tu dominio si lo conectas), para que los enlaces de los correos
  vuelvan a la app.

## Paso 5 · Tareas de administración (editor SQL)

Busca el identificador de una persona en **Cloud → Users** y:

```sql
-- Hacer moderador a alguien (puede revisar denuncias)
insert into public.user_roles (user_id, role) values ('ID-DE-LA-PERSONA', 'moderator');

-- Incógnito: lo concede el servidor tras el pago. Mientras no haya pagos, se puede regalar a mano:
insert into public.incognito_sessions (user_id, ends_at, source)
values ('ID-DE-LA-PERSONA', now() + interval '24 hours', 'regalo');

-- Denuncias pendientes
select * from public.reports where status = 'review' order by created_at;

-- Cuentas que pidieron borrarse y el servidor no pudo borrar al momento (bórralas en Cloud → Users)
select * from public.account_deletions;
```

## Qué sigue siendo demostración

Pagos y créditos (Impulsar, Promocionar, Premium), audio en directo (Audio Wall), herramientas de negocio (Spotly
Local), verificación de identidad con documento y notificaciones push. Están rotulados en la app y no cobran ni
envían nada.

## Si algo falla

- **Un error al ejecutar el SQL**: copia el mensaje completo y pásamelo; no lo ejecutes a trozos.
- **La app sigue diciendo que la nube no está activada**: cierra sesión y vuelve a entrar (la app lo comprueba al
  entrar y al volver a la app).
- **Volver atrás**: no hay botón para deshacer. Se pueden borrar las tablas desde el editor SQL, pero se perderían
  los datos; consúltalo antes.

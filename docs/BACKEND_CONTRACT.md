# Spotly — contrato de backend

Qué es real y qué sigue siendo demostración, y qué falta conectar. El esquema real está en
`supabase/migrations/20261008140000_spotly_social.sql` (se activa con `docs/ACTIVAR_NUBE.md`) y el cliente en
`src/lib/cloud/` (`api.ts` contiene todas las llamadas). Todo lo comercial se lee de `src/lib/spotlyConfig.ts`
(precios, duraciones, radios): no hay importes en el código de las pantallas.

## Principios (no negociables)
1. Spotly es voz: el único texto libre es el título del Spot (y nombre, usuario, título de grupo, comunidad o evento).
2. Publicar, descubrir y hacerse viral es gratis. Pagar = más distribución, frecuencia, promoción de perfil o anuncio
   local. **Nunca** compra seguidores, reputación, veracidad ni inmunidad de moderación.
3. Incógnito (de pago): identidad pública oculta, identidad interna siempre conocida y moderable. Lo concede el
   servidor; nunca se revela solo.
4. Nada inventado con una cuenta real: las cifras y distintivos de ejemplo solo existen en el modo demostración.

## Cómo decide la app dónde guardar
- **Nube**: con sesión iniciada, la migración aplicada (`api.probe`) y fuera del modo demostración.
- **Dispositivo**: sin sesión, sin migración o sin conexión. Voces y Spots van a IndexedDB (`lib/voice/notes.ts`,
  `lib/spots.ts`) con la misma interfaz; la vista previa y la PWA de prueba compilan con `VITE_SPOTLY_CLOUD=off`.
- Ajustes muestra en qué modo estás («Tus Spots, voces y chats están en la nube…»).

## Implementado en la nube (tablas → pantallas)
| Tablas y vistas | Pantallas |
|---|---|
| `profiles` / `profiles_public` (usuario único, nombre, ciudad, foto, portada) | Perfil, autor, personas, búsqueda |
| `follows`, `blocks` (bloquear deja de seguir en ambos sentidos) | Seguidores, Siguiendo, seguridad |
| `spots` / `spots_public`, `spot_likes`, `saved_spots`, `spot_views` (una vista por persona y día) | Inicio (Todo, Cerca, Suscrito, España), Spot, mapa, fotos, perfil |
| `voice_notes` / `voice_notes_public` (encadenadas con `parent_id`), `voice_likes` | Mensajes de voz de Spots, fotos, perfil, grupos, comunidades y eventos |
| `chats`, `chat_members`, `my_chats` | Chats de voz 1 a 1 y de grupo |
| `stories` / `stories_public` (caducan a las 24 h) | Historias |
| `communities` / `communities_public`, `community_members` | Comunidades (conversación en el hilo `group:<id>`) |
| `events` / `events_public` (con audio-flyer), `event_attendees` | Eventos (conversación en el hilo `event:<id>`) |
| `thread_events` (tiempo real sin datos personales) | Avisos en directo de cada conversación |
| `reports`, `user_roles` (moderador) | Denunciar y moderar |
| `incognito_sessions` (solo escribe el servidor) | Publicar y hablar como «Anónimo» |
| `account_deletions` + `delete_my_account()` | Ajustes → Eliminar cuenta |
| Almacenamiento `voces`, `media`, `perfiles` (públicos, rutas imposibles de adivinar) y `chats` (privado) | Audio, fotos, vídeos, foto y portada |

Funciones RPC: `open_direct_chat`, `create_group_chat`, `delete_voice_note`, `record_spot_view`, `ensure_my_profile`,
`delete_my_account`. Avisos (`fetchActivity`): nuevos seguidores, voces en tus Spots y tu muro, notas en tus chats.

Seguridad cubierta por `supabase/tests`: RLS de cada tabla, autores anónimos enmascarados en las vistas `*_public`,
reglas de rutas del almacenamiento, límites de ritmo, bloqueos y borrado de cuenta.

## Pendiente (hoy es demostración rotulada)
| Función | Qué falta |
|---|---|
| Pagos y créditos: Impulsar, Promocionar perfil, Premium, Incógnito, wallet | Pasarela. En iOS/Android, compra integrada de Apple y Google Play Billing para contenido digital; webhook que escriba `incognito_sessions` y los impulsos. |
| Spotly Local: negocios, campañas, ofertas flash, anuncios patrocinados | Tablas de negocio y campañas con moderación previa; el feed solo mostraría campañas activas dentro de radio, horario y días, con la etiqueta «Patrocinado». |
| Audio en directo (Audio Wall, emitir un directo) | Transporte de audio en tiempo real (p. ej. WebRTC/SFU) y moderación de salas. |
| Verificación de identidad (documento, selfie, teléfono, Creador) | Proveedor KYC con webhook (`approved/review/rejected/invalid/duplicate`). El selfie local (detector facial en el dispositivo) es solo un filtro inicial; no se guardan documentos ni se declara verificado a nadie. |
| Notificaciones push | APNs/FCM y tabla de tokens por dispositivo. |
| Búsqueda por voz | Transcripción en servidor (hoy la búsqueda por texto de títulos sí es real). |
| Actividad por municipio, «personas cerca» con distancia | Coordenadas de los Spots (hoy solo ciudad o zona) y agregados por lugar. |
| Traducción y transcripción de voz | Servicios externos; en Privacidad solo guardan la preferencia. |

## Etiquetado obligatorio en el feed
`Impulsado` (impulso), `Patrocinado` (campaña local), `Promocionado` (perfil). Nunca mezclados con contenido orgánico
sin etiqueta. Con la nube activada no aparecen anuncios ni Hot Spots de ejemplo.

## Acceso y cuentas (Lovable Cloud / Supabase Auth)
- Correo y contraseña: `signUp` (metadatos `username`, `accepted_terms_at`, `min_age_confirmed`), código de 6 cifras
  con `verifyOtp {type:"signup"}` (la plantilla «Confirm signup» debe incluir `{{ .Token }}`), `signInWithPassword`,
  `resetPasswordForEmail`, `updateUser({password})`. Contraseña mínima de 8.
- Apple y Google: OAuth gestionado por Lovable (`@lovable.dev/cloud-auth-js`) en la web. En las apps nativas falta
  configurar enlaces profundos o los plugins nativos (`docs/APPS_NATIVAS.md`).
- Al registrarse, `handle_new_user` crea el perfil con el usuario elegido (si ya existe, el registro falla y la app
  pide otro); con Apple o Google se asigna uno provisional que se cambia en el perfil. `user_metadata.onboarded`
  marca si ya se hizo la bienvenida.
- Edad mínima (18) y resúmenes de términos y privacidad: borradores pendientes de revisión jurídica.

## Geografía (España)
Provincias (52, con Ceuta, Melilla, Canarias y Baleares): geometría IGN vía `es-atlas` (MIT). Municipios (8.131): INE
vía `@doncicuto/es-municipalities` (MIT). Datos empaquetados en `src/data/es-*.json`; buscador sin conexión en
`src/lib/geo.ts`. La provincia se detecta del GPS en el propio móvil (`provinceAt`), sin geocodificación externa.

## Publicación de apps
iOS y Android con Capacitor: `docs/APPS_NATIVAS.md`. Web instalable (PWA): la versión publicada desde Lovable.

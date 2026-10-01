# Spotly — contrato de backend (frontend listo, datos simulados)

El frontend funciona 100 % con estado local (`src/lib/store.ts`) y datos de muestra (`src/lib/sampleData.ts`).
Todo lo comercial se lee de `src/lib/spotlyConfig.ts` (precios, duraciones, radios): **no hay importes en el código de las pantallas**.
Para pasar a producción hay que sustituir cada función del store por una llamada a estas entidades. Nada de lo marcado como *demo* debe presentarse como real.

## Principios (no negociables)
1. Cuentas solo de personas verificadas. Publicar, descubrir y viralizar es gratis.
2. Pagar = más distribución, frecuencia, Top, promoción de perfil o anuncio local. **Nunca** compra seguidores, reputación, veracidad ni inmunidad de moderación.
3. Incógnito: identidad pública oculta, identidad interna siempre conocida y moderable. Nunca se revela solo.

## Entidades
| Tabla | Campos clave | Pantalla que la usa |
|---|---|---|
| `profiles` | id, handle, city, verified_status (`none/pending/approved/rejected`), badges[] | Perfil, Personas |
| `identity_sessions` | user_id, method, status, provider_ref, reviewed_at | Identity.tsx (*demo*: sin proveedor KYC) |
| `spots` | id, author_id, audio_url, duration, topic, place_id, precision, visibility, incognito_session_id?, created_at | Feed, Crear, Hot Spots |
| `spot_reactions` / `spot_confirmations` | spot_id, user_id | "Confirmo que está pasando" |
| `follows` | follower_id, followee_id | Siguiendo |
| `blocks` / `reports` | user_id, target, reason, status (`review/resolved/removed`) | Safety.tsx |
| `incognito_sessions` | user_id, starts_at, ends_at?, duration (`15m/1h/6h/24h/7d/perm`), extended_count, price_credits | Incognito |
| `wallets` / `credit_ledger` | user_id, balance; entry(type, credits, ref) | Credits, TxHistory |
| `orders` | id, kind (`digital/local`), lines[], total_eur, credits_used, status | `Checkout` unificado |
| `boosts` | spot_id, level (`x2/x5/x10`), radius, starts_at, ends_at, top_now | BoostFlow, "Ahora en Spotly" |
| `profile_promos` | user_id, intensity, radius, ends_at, metrics{reached, visits, follows} | PromoProfile |
| `business_profiles` | owner_id, name, category, address, hours, availability | Spotly Local |
| `campaigns` | business_id, radius_km, schedule, days[], budget_eur, audio_url, status | Local, feed patrocinado |
| `flash_offers` | business_id, text, ends_at, stock | FlashOfferCard |
| `places` | id, name, kind (`city/town`), lat, lng, photo_count | PhotoWall, SpainMap |
| `photos` | id, place_id, author_id, url, tags[], created_at, moderation_status | PhotoWall |
| `chats` / `chat_messages` | members[], group?, message(kind: voice/gif/image/reaction, url, duration), read_at | VoiceChats |
| `push_subscriptions` | user_id, platform (`ios/android/web`), token | PWA / Capacitor |

## Contratos de función (sustituir el store)
- `getConfig(): SpotlyConfig` — precios/duraciones editables sin desplegar.
- `createSpot(input): Spot` · `confirmHotSpot(spotId)` · `reportContent(target, reason)` · `blockUser(id)`.
- `checkout(order): {status, receipt}` — pasarela (Stripe/Apple IAP/Google Play Billing). En iOS/Android los créditos digitales **deben** usar IAP de cada tienda.
- `startIncognito(duration)` · `extendIncognito()` · `endIncognito()`.
- `startBoost(spotId, level, radius)` · `startProfilePromo(intensity, radius)`.
- `createCampaign(input)` → estado `review` hasta moderación; el feed solo muestra campañas `active` dentro de radio/horario/días.
- `searchVoice(audio|text)` — transcripción en servidor; hoy es *demo* local.
- Ajustes "Modo viaje", "Traducción de voz" y "Transcripción con IA" (Privacidad → *Vista previa*): solo guardan preferencia; requieren servicios de traducción/transcripción.

## Etiquetado obligatorio en feed
`Impulsado` (boost), `Patrocinado` (campaña local), `Promocionado` (perfil). Nunca mezclarlos con contenido orgánico sin etiqueta.

## Publicación de apps
### iOS / Android (Capacitor)
`capacitor.config.ts` apunta ahora a la vista previa de Lovable (`server.url`) para desarrollo. **Para builds de tienda**: elimina el bloque `server`, ejecuta `npm run build`, `npx cap sync` y abre Xcode / Android Studio (`npx cap open ios|android`). Añadir permisos: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription` (iOS) y `RECORD_AUDIO`, `CAMERA`, `ACCESS_COARSE_LOCATION` (Android).
### Windows
La app es instalable como PWA (Edge/Chrome → "Instalar Spotly"; ver Perfil → Instalar app). Para Microsoft Store: empaquetar con PWABuilder (MSIX) o un contenedor Tauri sobre la misma URL/build.

## Geografía (España)
- Provincias (52, incl. Ceuta, Melilla, Canarias y Baleares): geometría IGN vía `es-atlas` (MIT). Municipios (8.131): INE vía `@doncicuto/es-municipalities` (MIT). Datos empaquetados en `src/data/es-*.json`; buscador offline en `src/lib/geo.ts`.
- Las cifras de actividad por ciudad son DEMO hasta conectar `GET /v1/places/{id}/activity`.

## Chats de voz: presencia y escritura
- `GET /v1/chats`, `GET /v1/chats/{id}/messages` (autor `me|them` para alinear burbujas).
- Tiempo real (WebSocket/Realtime): eventos `presence` (`online|offline`, `lastSeen`) y `typing` (`start|stop`, TTL 5 s). La demo simula ambos con temporizadores.

## Verificación de identidad
- `POST /v1/identity/sessions { tier: basic|premium|creator, methods: [doc,selfie,phone,social,creator] }` → `{ sessionId }`; estado por webhook (`approved|review|rejected|invalid|duplicate`).
- Asterisco público solo con `approved` y nivel ≠ `basic`; el distintivo Creador requiere revisión manual. La demo elige el resultado a mano y lo rotula DEMO; las fotos no salen del dispositivo.

## Onboarding
- Ubicación: `navigator.geolocation` (opcional, nunca bloquea). Ciudad: búsqueda local en `geo.ts`; «Usar mi ubicación actual» requiere geocodificación inversa en backend (DEMO: Sevilla).

## Acceso y cuentas (Supabase Auth)
- Correo + contraseña: `signUp` (metadata: `username`, `accepted_terms_at`, `min_age_confirmed`), `verifyOtp {type:"signup"}` (código de 6 cifras), `signInWithPassword`, `resetPasswordForEmail`, `updateUser({password})`. Apple/Google: OAuth.
- Plantilla de correo «Confirm signup» debe incluir `{{ .Token }}` (código) además del enlace. Activar confirmación de correo y fijar longitud mínima de contraseña a 8 (igual que `auth.minPassword`).
- Recuperación: el cliente escucha `PASSWORD_RECOVERY` y muestra la pantalla de nueva contraseña. Nunca se revela si un correo existe.
- `user_metadata.onboarded` marca si ya se completó el onboarding.
- Nombre de usuario único: crear `profiles(id uuid pk references auth.users, username text unique check (username ~ '^[a-z][a-z0-9_.]{2,19}$'))` con trigger `on auth.users insert` que copie `raw_user_meta_data->>'username'` y devuelva error si ya existe. La disponibilidad se valida al crear la cuenta (la UI no finge comprobarla antes).
- Edad mínima y textos legales: `auth.minAge` (18) y resúmenes de términos/privacidad son BORRADOR; requieren revisión jurídica.

## Verificación por niveles y prueba de vida
- `basic` (gratis): SOLO selfie en tiempo real (persona real). Sin documento ni teléfono.
- `premium` (de pago, precio en `verificationPricesEur`): documento + selfie + teléfono (SMS) y redes opcionales. Asterisco público.
- `creator` (de pago): premium + revisión manual de creador.
- El selfie usa la cámara real y un detector facial local (tiny face detector + 68 puntos, ~270 KB, sin enviar vídeo): una cara, encuadre, parpadeo y giro a ambos lados. Es un filtro inicial; la prueba de vida definitiva (anti-foto/pantalla/deepfake) debe hacerla un proveedor KYC en servidor. Si no hay detección automática, el selfie pasa a revisión manual.
- Las vistas previas incrustadas (iframe) bloquean la cámara por política del navegador; en la app instalada (Capacitor: permiso `NSCameraUsageDescription` / `CAMERA`) o en la web directa funciona.

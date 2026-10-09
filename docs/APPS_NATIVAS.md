# Apps de iPhone y Android (Capacitor)

Spotly se empaqueta como app nativa con Capacitor: la misma app de producción va **dentro** de la app (no depende de
una URL de vista previa) y usa la misma nube que la web, así que las cuentas y los datos son los mismos en iPhone,
Android y la web.

## Qué está listo

- `vite.app.config.ts` compila la app como web estática con la nube activada → `dist-app/` (entrada en `app/`).
- `capacitor.config.ts` empaqueta `dist-app/`. Con `CAP_SERVER_URL` apunta a un servidor de desarrollo para probar
  con recarga en vivo.
- Dependencias de Capacitor 8 (`@capacitor/core`, `ios`, `android`, `cli`) en `package.json`.
- Probado aquí: la compilación y la prueba de dos personas contra un Supabase local con esa misma web estática
  (`E2E_APP_BUILD=app supabase/tests/run-e2e.sh`). **No probado aquí**: Xcode, Android Studio ni móviles reales
  (este entorno no los tiene).

## Compilar (en un Mac con Xcode para iPhone; Android Studio para Android)

1. Crea `.env.local` en la raíz (no se sube al repositorio):

   ```
   VITE_SUPABASE_URL=https://vjimjvnqmeolxgnshvfd.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<la clave publicable del proyecto>
   ```

   La URL sale del `project_id` de `supabase/config.toml`; si no te encaja o no tienes la clave, pídele al chat de
   Lovable «dame VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY de este proyecto». La clave publicable no es
   secreta (ya va dentro de la web publicada); la *service role* nunca debe ir en la app.

2. Compila y sincroniza:

   ```sh
   npm ci
   npx vite build -c vite.app.config.ts
   npx cap add ios        # solo la primera vez
   npx cap add android    # solo la primera vez
   npx cap sync
   npx cap open ios       # o: npx cap open android
   ```

3. Permisos (textos que verá la persona):

   - **iOS** (`ios/App/App/Info.plist`):
     - `NSMicrophoneUsageDescription`: «Spotly usa el micrófono para grabar tus Spots y tus respuestas de voz».
     - `NSCameraUsageDescription`: «Para hacer la foto de tu Spot o de tu perfil».
     - `NSPhotoLibraryUsageDescription`: «Para elegir fotos de tu galería».
     - `NSLocationWhenInUseUsageDescription`: «Para saber tu zona y enseñarte lo que pasa cerca».
   - **Android** (`android/app/src/main/AndroidManifest.xml`): `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `CAMERA`,
     `ACCESS_COARSE_LOCATION` (y `ACCESS_FINE_LOCATION` si quieres más precisión).

## Antes de enviarlas a App Store y Google Play

- **Identificador de la app**: `appId` es ahora el de Lovable (`app.lovable.…`). Pon el tuyo (por ejemplo
  `es.spotly.app`) **antes** de crear la ficha en las tiendas: después no se puede cambiar.
- **Entrar con Apple y Google en la app**: en la web funcionan; dentro de la app nativa necesitan enlaces profundos o
  sus plugins nativos (con `signInWithIdToken`), que aún no están configurados. Mientras, la app lo explica y se entra
  con correo y contraseña, que sí funciona.
- **Pagos**: Impulsar, Promocionar, Premium e Incógnito son demostración. Para cobrar contenido digital en las apps
  es obligatorio usar la compra integrada de Apple y Google Play Billing. Valora ocultar esas pantallas en la versión
  de tienda hasta que cobren de verdad, para que la revisión no las vea como funciones rotas.
- **Notificaciones push**: falta configurar APNs (Apple) y FCM (Google) y guardar los tokens en el servidor.
- **Borrar la cuenta desde la app**: ya está (Ajustes → Eliminar cuenta), como exigen ambas tiendas.
- **Márgenes de la pantalla**: `ios.contentInset` está en `always`; compruébalo en un iPhone real. Si la cabecera o
  la barra inferior quedan con doble margen, cámbialo a `never` (la app ya respeta las zonas seguras).
- **Textos legales**: edad mínima, términos y privacidad son borradores; necesitan revisión jurídica.

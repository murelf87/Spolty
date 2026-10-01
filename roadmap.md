# Roadmap Spotly

- [x] Unificar referencias duplicadas y conservar la identidad visual oficial.
- [x] Numerar las 14 láminas y asignar referencias maestras a cada grupo de pantallas.
- [x] Construir una primera vista móvil funcional y visible en la previsualización.
- [x] Reconstruir el primer bloque visual según las láminas 13 y 14: acceso, Inicio, navegación y Crear Spot.
- [ ] Inventariar y reconstruir por separado cada microestado visible dentro de las 14 láminas: pestañas, detalles, modales, selecciones, confirmaciones y estados activos.
- [x] Onboarding tras "Crear cuenta": intereses, permisos, ciudad, modo de uso y presentación de voz (lámina 7).
- [x] Reconstruir Explorar, mapa, personas, fotos, ciudades y pueblos según las láminas 7–11, incluyendo sus pantallas internas.
- [x] Reconstruir perfil, Audio Wall, chat, comunidades y eventos según las láminas 4, 7 y 8, incluyendo sus pantallas internas.
- [x] Reconstruir verificación, ajustes, Premium e impulso según las láminas 4, 12 y 14, incluyendo sus pantallas internas.
- [x] Completar navegación y flujos frontend prioritarios del documento maestro: Inicio, Explorar, Crear, Actividad, Perfil, logo, bienvenida, verificación, wallet/impulso, chats de voz, Panel Local, comunidades, eventos, ciudades/pueblos, búsqueda por voz y privacidad/incógnito.
- [x] Validar la primera fase en tamaño móvil y corregir errores visibles.
- [x] Repasar las dos últimas láminas en móvil y ajustar mapa, ciudad y avisos con la composición de referencia.
- [x] Añadir el flujo visual de emisión de un directo desde Crear Spot: preparación, controles del anfitrión, público y cierre; emisión real pendiente de la fase posterior.
- [x] Ampliar Crear Spot y Directo con apartados útiles de una red social de audio: tema, participación por voz, privacidad, zona, controles de anfitrión y resumen; mantener explícita la naturaleza de demostración.
- [x] Comparar las 13 vistas de la lámina de impulso con Inicio, publicación, niveles, frecuencia, público, resumen, destacados, negocio local, seguidores, estadísticas y créditos; corregir programación visual, coherencia de presupuesto y zona, y marcar cobros y métricas como ejemplos.
- [ ] Fase posterior: conectar datos reales, audio, pagos y mapas; cuentas Apple y Google ya están activadas.
- [~] (config Capacitor lista; falta abrir Xcode/Android Studio en local) Empaquetar primero las versiones nativas para iPhone y Android, integrar permisos de cámara, micrófono, ubicación y notificaciones, y prepararlas para App Store y Google Play.
- [~] (instalable lista; datos compartidos en fase backend) Preparar después la versión web instalable, conectada a las mismas cuentas y datos que iPhone y Android.

- [x] Comparar la lámina de 18 vistas de verificación; rehacer flujo visual de métodos, documento, selfie y resultado ilustrativo, y probarlo en móvil.
- [ ] Fase posterior: comprobación real de identidad, conexión con redes sociales y certificación de insignias; no simularlas como completadas.
- [x] Acercar los perfiles de muestra, las fotos y el filtro Verificados/Online en Personas a la nueva lámina.
- [x] Completar los distintivos ilustrativos de la lámina de verificación en mapa, fotos, chat y eventos; añadir búsqueda de creadores y filtro solo verificados, y comprobar estos recorridos en móvil.
- [x] Habilitar cuentas reales con Apple y Google sin perfiles adicionales, conservando una entrada de demostración independiente.
- [ ] Bloqueado hasta elegir un proveedor especializado: verificar de verdad DNI, selfie/prueba de vida y emitir distintivos auténticos; no almacenar documentos ni declarar verificados por el recorrido ilustrativo.
- [x] Recrear la lámina 10 de Audio Wall en directo con retratos, filtros, búsqueda y una sala que se puede abrir y abandonar como demostración.
- [x] Recrear la lámina de Chat de voz: bocadillos con ondas, grabar manteniendo pulsado, reproducir notas propias, y menú «+» con GIF animados, imágenes y reacciones. Los mensajes de muestra no tienen audio y los envíos no persisten.
- [x] Ajustar la bienvenida de la lámina 1 con el logo original, Tierra nocturna y señales de voz, botones de acceso y accesos sociales; X se señala como no disponible.
- [x] Ajustar las vistas 3 y 4 de publicación/impulso a la referencia: foto, opciones, niveles, insignia, estados y navegación móvil; conservar las funciones de muestra sin cobros reales.

- [x] Extensión "Prompt maestro": monetización sin pay-to-win, Incógnito, Hot Spots, mapa social/España, Photo Explorer, Spotly Local, wallet + checkout único, tema oscuro y Perla, layout de escritorio, PWA instalable (Windows/Android/iOS) y chats con pestañas. Contrato de datos en `docs/BACKEND_CONTRACT.md`.
- [ ] Backend real: KYC, pagos/IAP, audio, mapas reales, traducción/transcripción, push (ver `docs/BACKEND_CONTRACT.md`).

## Pendiente antes de publicar en tiendas
- Conectar backend real: verificación de identidad (proveedor KYC), SMS, pagos/créditos, presencia y escritura en chats, actividad por municipio y geocodificación inversa ("Usar mi ubicación actual").
- Capacitor (iOS/Android): `npx cap add ios android`, permisos de micrófono/ubicación/cámara en Info.plist y AndroidManifest; PWA instalable en Windows ya incluida.
- Sustituir imágenes de ejemplo por contenido de usuarios y las cifras DEMO por datos reales.

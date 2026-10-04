<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Spotly frontend uses a single mobile-first shell with state-driven primary tabs, because the reference defines app navigation rather than separate shareable content pages.
- Spotly brand colors and effects live in `src/styles.css`; feature components use semantic token utilities only, so visual identity remains consistent.
- Spotly's primary production targets are native iPhone and Android apps packaged with Capacitor, followed by an installable web app; user data remains in the shared cloud backend so all three clients interoperate.
- The user started the account and identity phase; use Lovable Cloud for Apple/Google sign-in, but keep other social features as demos until explicitly connected, to preserve the current visual prototype.
- The host live-broadcast experience is a separate stateful frontend flow opened from Create Spot, with topic, voice-first format, area, audience, moderated voice requests, room settings, camera, microphone, timer and ending summary; all are visibly demo-only because streaming and persistence are intentionally out of scope.
- Spot publication keeps discovery topic, approximate area, audience and voice-reply controls in its review step, because an audio-first social post needs discoverability and conversation settings before sharing.

- Verification remains a self-contained illustrative frontend flow without document capture, biometric processing, or account status mutation until an identity provider is selected, because sign-in proves account ownership, not legal identity.
- The Audio Wall discovery screen stays separate from private voice chats, and its room joining is labeled demo-only because live audio transport is not yet implemented.
- Voice chats use actual browser microphone recording and local object URLs only for user-made notes, while sample messages and shared GIFs/images are local-only; this avoids claiming delivery or persistence before the social backend exists.
- The artifact preview (`preview.html`) is a separate single-file build (`npx vite build -c vite.preview.config.ts`, sources in `preview/`): `<body>` acts as the iPhone screen so `fixed` overlays stay inside it, and `preview/phone-css.ts` evaluates media queries at 390 px and maps vh and safe-area insets to the simulated phone, so app components keep plain production code with no preview-only branches.
- The phone-test PWA is a separate demo build without backend (`npx vite build -c vite.mobile.config.ts`, sources in `mobile/`) published only as build output on the `gh-pages` branch (GitHub Pages: https://murelf87.github.io/Spolty/), together with `expo/App.js` to open it inside Expo Go; `main` stays the Lovable-synced source.
- Profile, author and photo-wall thumbnails always open something: photos and videos use the sample registry `src/lib/media.ts` (short demo clips in `src/assets/videos` made from the sample photos) and the shared `MediaViewer`, until the social backend provides real media.
- Every phone gets the same proportions: on viewports up to 480 px the root font size is fluid (16 px at 390 px, clamped 14–17.5 px) and all component sizes are rem (named small text sizes `text-2xs/3xs/4xs`, lucide icon sizes mapped to rem in `src/styles.css`), so no fixed px sizes except hairlines, borders, shadows and desktop widths.
- Screens share one structure from `kit.tsx`: `TopBar` (top spacing from `--safe-header`) for every header, `BottomSheet` for every sheet, and the default `Button` as the brand gradient pill (buttons with their own background add `bg-none`), because consistency across screens was an explicit request.
- Poppins is bundled in `src/assets/fonts/poppins` (OFL) instead of Google Fonts, so iPhone, Android, the PWA, the preview and Capacitor render the same typography offline and without third-party requests.
- Every audio shows its author's name and photo (`useMe`, `MeAvatar`); only paid Incógnito turns it into a ghost labelled «Anónimo» (`SignAs`, `AnonAvatar`, `AudioRow anon`), and the user's profile (name, user, bio, cropped 512 px photo) lives in the store, persisted to localStorage, until the profile backend exists.

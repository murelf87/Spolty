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

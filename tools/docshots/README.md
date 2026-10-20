# Design-doc screenshot harness (2026-10-19)

Regenerates `public/summoners-gambit-design-doc.html` + `public/img/docs/*.webp` from the live build.
Run by Claude in its cloud workspace (Playwright + Chromium); paths inside the scripts point at that workspace.

1. Copy `server.js` and `public/` (html, common.js, img PNGs, animations) into a scratch `game/` folder;
   build `srv_doc.js` from server.js (listen guarded by `require.main`, exports rooms/broadcast/ROSTER/etc.).
2. Install Cinzel locally (google/fonts `ofl/cinzel`) and supply lottie-web + qrcodejs (routed in `h.mjs`).
3. `node s1.mjs … s5.mjs` → `shots/*.png` (s1 lobby, s2 setup, s3 turn/claim/battle, s4 specials/tally/wild cards/menus/pause/game over, s5 card galleries + detail sheets).
4. `python3 gen.py shots public/img/docs public/summoners-gambit-design-doc.html` → WebP images + doc.
5. `node docshot.mjs` → sanity check (no broken images / console errors).

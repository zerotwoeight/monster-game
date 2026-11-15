// board-temple.js v1.1 (2026-11-13, board v0.6.85) — sizes from the Size Lab: card 0.9, grow 1.20, title 20.
// v1.0 (board v0.6.84) — Temple v2 on the board.
// One card, front and centre, mirrors the card the player is looking at on their phone (G.pendingTemple.view).
// Nothing picked yet → a face-down Temple card. The Ascendant stays hidden until the offer is made.
// Offer (G.templeResult with .ascendant) → the card grows like the Omen reveal and flips to the Ascendant for everyone
// (the Ascendant's voice line is played by the normal voice hook, timed to the flip). Leave → the card fades away.
// State-driven: board-render.js calls TempleFX.sync(G) after every render.
const TempleFX = (() => {
  const S = { stage: null, card: null, key: null, seen: null, busy: false, shownAt: 0 };
  const css = `
  .tpx-stage{position:fixed;left:0;top:0;pointer-events:none;z-index:60;transform:translate(-50%,-50%);text-align:center;transition:opacity .45s}
  .tpx-title{font-family:'Cinzel',serif;font-weight:700;letter-spacing:.12em;color:#f0dca8;text-shadow:0 0 18px rgba(201,169,110,.6);white-space:nowrap}
  .tpx-sub{color:#cfc9e6;font-family:Inter,sans-serif;white-space:nowrap;opacity:.9}
  .tpx-wrap{perspective:1200px;display:inline-block;margin:22px 0 26px}
  .tpx-card{position:relative;width:130px;height:186px;border-radius:10px;background:#0f0d1c;transform-style:preserve-3d;transform-origin:50% 50%}
  .tpx-card>.tpx-face{position:absolute;inset:0;backface-visibility:hidden}
  .tpx-back{border-radius:10px;border:2px solid #c9a96e;background:radial-gradient(ellipse at 50% 40%,#3a2d63 0%,#16122b 70%);
    box-shadow:0 0 0 2px rgba(201,169,110,.25),0 0 30px rgba(201,169,110,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
  .tpx-back .i{font-size:44px;filter:drop-shadow(0 0 10px #ffe6a0)}
  .tpx-back .q{font-family:'Cinzel',serif;color:#e8d5a3;font-size:11px;letter-spacing:.2em}
  .tpx-glow{position:absolute;left:50%;top:50%;width:340px;height:340px;margin:-170px 0 0 -170px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,230,160,.55) 0%,rgba(255,215,122,.18) 40%,transparent 70%);opacity:0;pointer-events:none}
  .tpx-cap{font-family:'Cinzel',serif;font-weight:700;color:#ffe6a0;letter-spacing:.1em;text-shadow:0 0 14px rgba(255,215,122,.7);opacity:0;white-space:nowrap}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const reduced = () => { try { return (window.BoardFX && BoardFX.level === 'reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function k() { const r = document.getElementById('scale-root'); return r ? (r.getBoundingClientRect().width / 1440 || 1) : 1; }
  function center() {
    const wc = document.querySelector('.wheel-center');
    if (wc) { const r = wc.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return { x: innerWidth / 2, y: innerHeight / 2 };
  }
  function layer() { let l = document.getElementById('fx-layer'); if (!l) { l = document.createElement('div'); l.id = 'fx-layer'; document.body.appendChild(l); } return l; }
  function place() {
    if (!S.stage) return;
    const c = center(), s = k();
    Object.assign(S.stage.style, { left: c.x + 'px', top: c.y + 'px' });
    S.stage.style.transform = `translate(-50%,-50%) scale(${s * 0.9})`;
  }
  const backHTML = `<div class="tpx-face tpx-back"><div class="i">🏛</div><div class="q">OFFERING</div></div>`;
  function build(name) {
    clear(false);
    const el = document.createElement('div'); el.className = 'tpx-stage'; el.style.opacity = '0';
    el.innerHTML = `<div class="tpx-title" style="font-size:20px">🏛 THE TEMPLE</div>
      <div class="tpx-sub" style="font-size:9px;margin:3px 0 10px">${escHtml(name)} is considering an offering…</div>
      <div class="tpx-wrap"><div class="tpx-glow"></div><div class="tpx-card">${backHTML}</div></div>
      <div class="tpx-cap" style="font-size:11px;margin-top:4px">&nbsp;</div>`;
    layer().appendChild(el);
    S.stage = el; S.card = el.querySelector('.tpx-card'); S.key = 'back'; S.shownAt = Date.now();
    place();
    requestAnimationFrame(() => { if (S.stage === el) el.style.opacity = '1'; });
  }
  function clear(fade) {
    const el = S.stage; S.stage = null; S.card = null; S.key = null; S.busy = false;
    if (!el) return;
    if (fade) { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); } else el.remove();
  }
  // swap the face shown (mirror the phone) with a quick fade
  function show(card) {
    if (!S.card) return;
    const key = card ? 'c' + card.iid : 'back';
    if (key === S.key) return;
    S.key = key;
    const html = card ? `<div class="tpx-face">${renderBoardCard(card)}</div>` : backHTML;
    const c = S.card;
    if (reduced()) { c.innerHTML = html; return; }
    c.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 140, fill: 'forwards' }).finished.then(() => {
      if (S.card !== c) return;
      c.innerHTML = html;
      c.animate([{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, fill: 'forwards', easing: 'cubic-bezier(.3,.7,.3,1)' });
    }).catch(() => {});
  }
  function caption(text) { const cap = S.stage && S.stage.querySelector('.tpx-cap'); if (cap) { cap.textContent = text; cap.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, fill: 'forwards' }); } }
  function setSub(text) { const s = S.stage && S.stage.querySelector('.tpx-sub'); if (s) s.textContent = text; }

  // Offer: grow (like the Omen reveal), flip to the Ascendant, hold, fade.
  function reveal(r, name) {
    if (!S.stage) build(name);
    show(r.offered); S.key = 'c' + (r.offered && r.offered.iid);
    S.busy = true;
    const c = S.card, glow = S.stage.querySelector('.tpx-glow'), el = S.stage;
    setSub(`${name} makes an offering…`);
    const red = reduced();
    const grow = red ? 0 : 700, half = red ? 0 : 320, hold = red ? 1800 : 2300;
    try { window.SFX && SFX.templeChoir && SFX.templeChoir(); } catch (e) {}
    const ascHTML = `<div class="tpx-face">${renderBoardCard(r.ascendant)}</div>`;
    if (red) {
      c.innerHTML = ascHTML; caption(`${r.ascendant.name} answers`);
      setTimeout(() => { if (S.stage === el) clear(true); }, hold);
      return;
    }
    glow.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.15)' }], { duration: grow + half * 2, fill: 'forwards' });
    c.animate([{ transform: 'scale(1) rotateY(0deg)' }, { transform: 'scale(1.14) rotateY(0deg)' }], { duration: grow, fill: 'forwards', easing: 'cubic-bezier(.3,.7,.3,1)' }).finished
      .then(() => c.animate([{ transform: 'scale(1.14) rotateY(0deg)' }, { transform: 'scale(1.18) rotateY(90deg)' }], { duration: half, fill: 'forwards', easing: 'ease-in' }).finished)
      .then(() => {
        if (S.card !== c) return;
        c.innerHTML = ascHTML;
        try { window.SFX && SFX.wildCardReveal && SFX.wildCardReveal('high'); } catch (e) {}
        return c.animate([{ transform: 'scale(1.18) rotateY(-90deg)' }, { transform: 'scale(1.2) rotateY(0deg)' }], { duration: half + 120, fill: 'forwards', easing: 'cubic-bezier(.2,.9,.3,1.2)' }).finished;
      })
      .then(() => {
        if (S.stage !== el) return;
        caption(`${r.ascendant.name} answers`);
        setTimeout(() => { if (S.stage === el) clear(true); }, hold);
      }).catch(() => {});
  }
  function leave(name) {
    if (!S.stage) return;
    S.busy = true;
    const el = S.stage;
    setSub(`${name} left the Temple`);
    if (!reduced() && S.card) S.card.animate([{ opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }, { opacity: 0, transform: 'scale(.9)', filter: 'blur(3px)' }], { duration: 900, fill: 'forwards' });
    setTimeout(() => { if (S.stage === el) clear(true); }, reduced() ? 600 : 1300);
  }

  function sync(G) {
    S.lastG = G;
    if (!G || G.phase === 'lobby') { clear(false); S.seen = null; return; }
    const r = G.templeResult;
    if (S.seen === null) { S.seen = r ? r.seq : 0; }   // first state after (re)load: never replay an old result
    if (r && r.seq !== S.seen) {
      S.seen = r.seq;
      const name = ((G.players || [])[r.playerIdx] || {}).name || 'A player';
      if (r.left) leave(name); else if (r.ascendant) reveal(r, name);
      return;
    }
    if (S.busy) { place(); return; }
    if (G.phase === 'resolve:temple' && G.pendingTemple) {
      const name = ((G.players || [])[G.currentPlayer] || {}).name || 'A player';
      if (!S.stage) {
        // first appearance: let the landing god-rays play first
        if (!S._wait) { S._wait = setTimeout(() => { S._wait = null; const L = S.lastG; if (L && L.phase === 'resolve:temple' && !S.stage) { build(name); sync(L); } }, 1300); }
        return;
      }
      place();
      show(G.pendingTemple.view ? G.pendingTemple.view.card : null);
    } else if (S.stage) clear(true);
  }
  addEventListener('resize', place);
  // v1.2 (board v0.7.3): the board's turn summary and Game Over wait while a Temple result is still to play or playing
  function pending(G) { const r = G && G.templeResult; return S.busy || !!(r && S.seen !== null && r.seq !== S.seen); }
  return { sync, pending, version: '1.2' };
})();

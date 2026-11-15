// player-battledice3d.js v1.0 (2026-11-15, player v0.5.71: IN THE GAME, loaded by player.html) · v0.3 (ATK / DEF wording, top margin 88) · v0.2 (2026-11-15; v0.2 = top-aligned: header and tray stay put, callouts only add below) · v0.1 (2026-11-15) — BATTLE DICE ON THE PHONE, 3D version. Also used by /player-dice-lab.html.
// Replaces player-battledice.js (v1.0) when it goes into the game. Same server messages (G.battleRoll, roll_battle_dice).
// The movement roll's felt tray, with a black die (your hit) and a white die (the hit you take), numbers on the faces.
// Tap the tray → the dice shake while the server rolls → they tumble in and land → one callout per die under the tray.
// No visible timer: the server still rolls for you after 12 s; then the dice are thrown as if you had tapped ("Rolled for you").
// Built once per roll and updated in place (v1.0 rebuilt the screen every 400 ms, which made the bar jump).
const PBD3 = {
  size: 64,        // die edge (px)
  gap: 58,         // each die's distance from the tray centre (px)
  trayH: 190,      // tray height (px)
  throwMs: 1150,   // tumble time
  stagger: 90,     // white die leaves after black
  spin: 1,         // tumble amount (×)
  bounce: 1,       // bounce height (×)
  critFx: true,    // 6 = sparks + long buzz · 1 = thud, no ring
  coFadeMs: 320,   // a callout sliding in
  coGap: 260,      // between the two callouts
  vibrate: true,
  topPad: 88,      // v0.2: space above the header (px); everything stacks down from here
};
window.PBD3 = PBD3;   // the Phone Dice Lab reads and tunes it
(function () {
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
  const TBL = () => (G && G.diceTables) || { black: [0.5, 0.9, 1, 1.1, 1.2, 1.5], white: [1.25, 1.1, 1, 0.9, 0.8, 0.6] };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const buzz = p => { try { PBD3.vibrate && navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  document.head.insertAdjacentHTML('beforeend', `<style>
  #pbd3{position:fixed;inset:0;z-index:9000;display:none;flex-direction:column;align-items:center;justify-content:flex-start;gap:14px;padding:22px 18px;text-align:center;background:rgba(8,8,18,.95);color:#ece6d8;font-family:Inter,system-ui,sans-serif;overflow:auto}
  #pbd3 .dice-tray{max-width:360px}
  .pbd3-face{position:absolute;inset:0;border-radius:18%;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;font-family:Inter,system-ui,sans-serif;font-weight:800;box-sizing:border-box}
  .pbd3-face.k{background:radial-gradient(circle at 30% 25%,#34314a,#16141f 60%,#0b0a12);color:#f2efe6;border:2px solid #7a6fc0;box-shadow:inset 0 0 12px rgba(0,0,0,.6)}
  .pbd3-face.w{background:radial-gradient(circle at 30% 25%,#fff,#efe9dc 60%,#d6cfbd);color:#15131f;border:2px solid #b9b19c;box-shadow:inset 0 0 10px rgba(0,0,0,.18)}
  .pbd3-floor{position:absolute;bottom:10px;font:700 10px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6f6a90;pointer-events:none;transform:translateX(-50%);white-space:nowrap}
  #pbd3 .bfx-list{max-width:360px}
  #pbd3 .bfx.neu{background:#1d1c2c;border:1px solid #4a4766} #pbd3 .bfx.neu .bfx-name,#pbd3 .bfx.neu .bfx-val{color:#cfc8ff}
  .pbd3-chip{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;font:800 15px/1 Inter,sans-serif;flex:none}
  #pbd3-foot{font:600 13px Inter,sans-serif;color:#8f8aa8;min-height:18px}
  </style>`);

  // ── sound: the movement roll's takes (dice-roll.mp3), on the phone's Sound Effects level ──
  const TAKES = [[0.12, 1.0], [1.52, 2.2], [3.02, 3.7], [4.42, 5.1], [5.52, 6.15], [6.82, 7.55], [8.37, 9.1], [9.47, 10.25], [10.67, 11.3]];
  let snd = null, sndT = null;
  function playRoll() {
    let L = 1; try { if (typeof _sfxLvl === 'function') L = _sfxLvl(); } catch (e) {} if (L <= 0) return;
    try { if (!snd) { snd = new Audio('/audio/dice-roll.mp3'); snd.preload = 'auto'; }
      const [a, b] = TAKES[Math.floor(Math.random() * TAKES.length)];
      clearTimeout(sndT); snd.volume = 0.7 * L; snd.currentTime = a; snd.play().catch(() => {}); sndT = setTimeout(() => { try { snd.pause(); } catch (e) {} }, (b - a) * 1000 + 120); } catch (e) {}
  }

  let el = null, tray = null, seq = null, state = null;   // state: { tapped, thrown, stopShake }
  function buildDie(sz, white) {
    const d = document.createElement('div'); d.className = 'dt-die'; d.style.width = d.style.height = sz + 'px'; const h = sz / 2;
    const t = { 1: `translateZ(${h}px)`, 6: `rotateY(180deg) translateZ(${h}px)`, 3: `rotateY(90deg) translateZ(${h}px)`, 4: `rotateY(-90deg) translateZ(${h}px)`, 2: `rotateX(90deg) translateZ(${h}px)`, 5: `rotateX(-90deg) translateZ(${h}px)` };
    for (const v in t) { const f = document.createElement('div'); f.className = 'pbd3-face ' + (white ? 'w' : 'k'); f.style.transform = t[v]; f.style.fontSize = Math.round(sz * .56) + 'px'; f.textContent = v; d.appendChild(f); }
    return d;
  }
  const geo = () => ({ cx: tray.clientWidth / 2, cy: tray.clientHeight - PBD3.size * .5 - 34, sz: PBD3.size, gap: PBD3.gap });
  function mk(cls, st) { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, st || {}); tray.appendChild(d); return d; }
  function stage(side, white) {
    const { cx, cy, sz, gap } = geo();
    const st = mk('dt-stage', { left: (cx + side * gap - sz / 2) + 'px', top: (cy - sz / 2) + 'px', width: sz + 'px', height: sz + 'px' });
    const sh = document.createElement('div'); sh.className = 'dt-shadow';
    Object.assign(sh.style, { width: sz * 1.2 + 'px', height: sz * .35 + 'px', left: (-sz * .1) + 'px', top: (sz * .9) + 'px' });
    st.appendChild(sh); const die = buildDie(sz, white); st.appendChild(die);
    return { st, sh, die };
  }
  function clearTray() { tray.querySelectorAll('.dt-stage,.dt-fx').forEach(e => e.remove()); }
  function idle() {   // resting dice before the tap, tilted like the movement roll's
    clearTray();
    [[6, -1, 16, false], [3, 1, -20, true]].forEach(([v, side, rz, white]) => { const { die } = stage(side, white); const [rx, ry] = FACE_ROT[v];
      die.style.transform = `rotateX(${rx - 14}deg) rotateY(${ry + 18 * side}deg) rotateZ(${rz}deg)`; });
  }
  function shake() {
    const an = [...tray.querySelectorAll('.dt-stage')].map(st => st.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-4px,-6px) rotate(-8deg)' }, { transform: 'translate(4px,-3px) rotate(7deg)' }, { transform: 'translate(0,0) rotate(0)' }], { duration: 260, iterations: Infinity }));
    return () => an.forEach(a => { try { a.cancel(); } catch (e) {} });
  }
  function ring(x, y, size, color) {
    const d = mk('dt-fx', { width: size + 'px', height: size + 'px', left: (x - size / 2) + 'px', top: (y - size / 2) + 'px', border: `3px solid ${color}`, boxShadow: `0 0 18px ${color}, inset 0 0 12px ${color}` });
    d.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(.6)', opacity: 1, offset: .15 }, { transform: 'scale(2.1)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => d.remove();
  }
  function sparks(x, y, color, n, dist) {
    for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2 + Math.random() * .5, r = dist * (.6 + Math.random() * .6), s = 4 + Math.random() * 4;
      const d = mk('dt-fx', { width: s + 'px', height: s + 'px', left: (x - s / 2) + 'px', top: (y - s / 2) + 'px', background: color, boxShadow: `0 0 ${s * 2}px ${color}` });
      d.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * r}px,${Math.sin(ang) * r}px) scale(.2)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' }).onfinish = () => d.remove(); }
  }
  // tumble in from above, two bounces, land on the server's faces (the movement roll's throw, black then white)
  function throwDice(b, w, color, onLand) {
    clearTray();
    const red = reduced(), dur = red ? 650 : PBD3.throwMs, sz = PBD3.size;
    setTimeout(playRoll, red ? 0 : 120);
    [[b, false], [w, true]].forEach(([v, white], i) => {
      const side = i ? 1 : -1, { st, sh, die } = stage(side, white), delay = i * PBD3.stagger;
      st.style.opacity = 0;
      const [rx, ry] = FACE_ROT[v] || [0, 0];
      const spinX = (red ? 360 : 720 + Math.floor(Math.random() * 2) * 360) * PBD3.spin * (Math.random() < .5 ? 1 : -1), spinY = (red ? 360 : 1080) * PBD3.spin * side;
      const sx = side * (70 + Math.random() * 40), sy = -(140 + Math.random() * 30) * PBD3.bounce, bb = PBD3.bounce;
      const T = (x, y, f, sc = 1) => `translate(${x}px,${y}px) rotateX(${rx + spinX * (1 - f)}deg) rotateY(${ry + spinY * (1 - f)}deg) scale(${sc})`;
      setTimeout(() => {
        die.animate(red ? [{ transform: T(0, -30, 0) }, { transform: T(0, 0, 1) }] : [
          { transform: T(sx, sy, 0, 1.15), offset: 0 }, { transform: T(sx * .35, sy * .1, .45, 1.05), offset: .38 },
          { transform: T(sx * .08, 0, .75), offset: .58 }, { transform: T(sx * .03, -18 * bb, .9), offset: .72 },
          { transform: T(0, 0, .98), offset: .86 }, { transform: T(0, -6 * bb, 1), offset: .93 }, { transform: T(0, 0, 1), offset: 1 }
        ], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
        st.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * .3, fill: 'forwards' });   // fade the stage, never the die
        sh.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { duration: dur * .6, fill: 'forwards' });
        setTimeout(() => {
          const x = parseFloat(st.style.left) + sz / 2, y = parseFloat(st.style.top) + sz / 2;
          if (v === 1 && PBD3.critFx) st.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9,.84)' }, { transform: 'scale(1)' }], { duration: 220 });
          else if (!red) ring(x, y, sz, color || '#c9a05a');
          if (v === 6 && PBD3.critFx && !red) sparks(x, y, white ? '#7ee0a0' : '#ffd77a', 14, 90);
        }, dur);
      }, delay);
    });
    setTimeout(() => { buzz(b === 6 || w === 6 ? [40, 40, 120] : (b === 1 || w === 1) ? [90] : 40); try { onLand && onLand(); } catch (e) {} }, dur + PBD3.stagger + 40);
  }
  // one callout per die, the board's wording
  function callout(white, v) {
    const t = TBL(), m = (white ? t.white : t.black)[v - 1], d = Math.round((m - 1) * 100);
    const word = white ? (v === 6 ? 'Braced' : v === 1 ? 'Exposed' : 'Defense') : (v === 6 ? 'Critical' : v === 1 ? 'Glancing' : 'Attack');
    const tone = d === 0 ? 'neu' : white ? (d < 0 ? 'good' : 'bad') : (d > 0 ? 'good' : 'bad');
    const val = d === 0 ? 'no change' : (white ? 'takes ' : '') + (d > 0 ? '+' : '−') + Math.abs(d) + '%';
    const chip = `<span class="pbd3-chip" style="${white ? 'background:#f2efe6;color:#15131f;border:2px solid #c9c4b4' : 'background:#15131f;color:#f2efe6;border:2px solid #7a6fc0'}">${v}</span>`;
    return `<div class="bfx ${tone}">${chip}<div class="bfx-main"><div class="bfx-name">${word}</div><div class="bfx-text">${white ? 'DEF' : 'ATK'} ×${m}</div></div><div class="bfx-val">${val}</div></div>`;
  }
  function showCallouts(mine) {
    const box = el.querySelector('#pbd3-co'); if (!box) return; box.innerHTML = '';
    [[false, mine.b], [true, mine.w]].forEach(([white, v], i) => setTimeout(() => {
      box.insertAdjacentHTML('beforeend', callout(white, v)); const r = box.lastElementChild;
      if (r && !reduced()) r.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: PBD3.coFadeMs, easing: 'ease-out', fill: 'backwards' });
    }, i * PBD3.coGap));
  }

  function build(R, side) {
    if (!el) { el = document.createElement('div'); el.id = 'pbd3'; document.body.appendChild(el); }
    const att = G.players[R.attIdx], def = R.defIdx != null ? G.players[R.defIdx] : null;
    const tile = att ? G.board[att.position] : null, defSummon = tile && tile.summon ? tile.summon.name : 'the defender';
    const attSummon = G.pendingAttackerSummon ? G.pendingAttackerSummon.name : 'their summon';
    const foe = side === 'att' ? (def ? def.name : 'the wild monster') : (att ? att.name : 'The attacker');
    const head = side === 'att'
      ? `<div style="font:700 13px Inter;letter-spacing:.2em;text-transform:uppercase;color:#a99fe0">Battle</div><div style="font:700 22px Georgia,serif;color:#ffd77a;line-height:1.25">${esc(attSummon)} attacks ${esc(defSummon)}</div>`
      : `<div style="font:700 13px Inter;letter-spacing:.2em;text-transform:uppercase;color:#e2685f">You are under attack</div><div style="font:700 22px Georgia,serif;color:#ffd77a;line-height:1.25">${esc(foe)} sends ${esc(attSummon)} at your ${esc(defSummon)}</div>`;
    el.innerHTML = head + `<div class="dice-tray idle" id="pbd3-tray" style="height:${PBD3.trayH}px;margin-top:6px"><div class="dt-label">TAP TO ROLL</div>`
      + `<div class="pbd3-floor" style="left:calc(50% - ${PBD3.gap}px)">ATK</div><div class="pbd3-floor" style="left:calc(50% + ${PBD3.gap}px)">DEF</div></div>`
      + `<div class="bfx-list" id="pbd3-co"></div><div id="pbd3-foot"></div>`;
    el.dataset.foe = foe;
    tray = el.querySelector('#pbd3-tray');
    tray.addEventListener('click', () => {
      if (!state || state.tapped || state.thrown) return;
      state.tapped = true; tray.classList.remove('idle'); const l = tray.querySelector('.dt-label'); if (l) l.remove();
      state.stopShake = shake(); buzz(30);
      if (typeof send === 'function') send('roll_battle_dice');
    });
    el.style.paddingTop = PBD3.topPad + 'px';   // v0.2
    el.style.display = 'flex';
    idle();
  }
  function foot(R, side) {
    const f = el && el.querySelector('#pbd3-foot'); if (!f) return;
    const mine = R[side], theirs = R[side === 'att' ? 'def' : 'att'];
    const txt = !mine ? '' : !theirs ? `Waiting for ${el.dataset.foe} to roll…` : 'Watch the board ⚔';
    const auto = mine && mine.auto ? '<div style="font:600 11px Inter;color:#6f6a90;margin-top:4px">Rolled for you</div>' : '';
    const html = txt + auto; if (f.dataset.h !== html) { f.dataset.h = html; f.innerHTML = html; }
  }
  function hide() { if (el) el.style.display = 'none'; if (state && state.stopShake) state.stopShake(); seq = null; state = null; }

  function update() {
    try {
      const R = G && G.battleRoll;
      if (!R || myIdx == null || (R.attIdx !== myIdx && R.defIdx !== myIdx) || G.phase !== 'resolve:battle') { if (el && el.style.display !== 'none') hide(); return; }
      const side = R.attIdx === myIdx ? 'att' : 'def';
      if (seq !== R.seq) { seq = R.seq; state = { tapped: false, thrown: false, stopShake: null }; build(R, side); if (side === 'def') buzz([60, 60, 60]); }
      const mine = R[side];
      if (mine && !state.thrown) {   // my roll is in (tapped, or rolled for me): throw
        state.thrown = true; if (state.stopShake) state.stopShake();
        tray.classList.remove('idle'); const l = tray.querySelector('.dt-label'); if (l) l.remove();
        const me = G.players[myIdx];
        throwDice(mine.b, mine.w, me && me.color, () => showCallouts(mine));
      }
      foot(R, side);
    } catch (e) { console.warn('[dice3d]', e); }
  }
  const origRender = render;
  render = function () { const r = origRender.apply(this, arguments); update(); return r; };
  setInterval(update, 400);   // safety net: some state updates redraw without render()
  window.PlayerDice3D = { update, hide };
})();

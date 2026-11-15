// board-battledice3d.js v1.2 (2026-11-15, board v0.7.2; v1.2 = callouts read Attack / Defense, ATK / DEF like the phone) · v1.1 (2026-11-15, board v0.7.1, server v1.0.161; v1.1 = the board tells the server when every die has landed + holdMs, and only then does the fight start) · v1.0 (board v0.7.0) — 3D BATTLE DICE, in the game. Values PINNED 2026-11-15 from the Battle Lab.
// (v0.1 was the lab-only trial.)
// Preview: each player's pair is thrown in from their side of the screen, tumbles across the board and settles
// just outside the arena (attacker left, defender right), like dice on a real table. No labels on the board.
// The dice stay until the fight starts, then fade. Fight: the small dice beside the names are gone; each die is a
// callout on the outer edge of its card, lighting up with the strike it affects (attacker black + defender white on
// the first strike, defender black + attacker white on the counter). Numerals on the faces (user's pick).
// Needs board-battledice.js (it builds on it) and the _bdStrike hooks in board-battle.js (v0.6.99).
const DICE3D = {
  on: true,
  size: 58,          // die edge in board px
  throwMs: 1300,     // time from off-screen to resting
  spin: 1,           // tumble amount (×)
  bounce: 1,         // bounce height (×)
  stagger: 50,       // white die leaves this long after black
  spread: 0.6,         // distance between the two dice of a pair (×)
  tilt: 14,          // max resting twist in degrees (thrown, not lined up)
  attX: 76, attY: 32,  // nudge the attacker's landing spot (board px)
  defX: -106, defY: -16,  // nudge the defender's landing spot
  critFx: true,      // Critical / Braced / Glancing / Exposed get their own beat
  critJolt: 1,       // strength of the Critical jolt (×)
  holdMs: 1200,      // v1.1: after the last die lands, this long to read the dice before the fight starts
  fadeMs: 400,       // dice fade when the fight starts
  coFadeMs: 280,     // a dice callout fading in
  coGap: 180,        // between the two callouts of one strike
};
(function () {
  // landing spots in board px, measured from the midpoint of the two preview cards (the user's marks, 2026-11-15)
  const SPOT = { att: { b: [-221, -214], w: [-306, -44] }, def: { b: [327, 7], w: [276, 194] } };
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
  const TBL = () => (G && G.diceTables) || { black: [0.5, 0.9, 1, 1.1, 1.2, 1.5], white: [1.25, 1.1, 1, 0.9, 0.8, 0.6] };
  const reducedFx = () => { try { return (window.BoardFX && BoardFX.level === 'reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const kScale = () => { const r = document.getElementById('scale-root'); return r ? (r.getBoundingClientRect().width / (r.offsetWidth || 1)) || 1 : 1; };

  document.head.insertAdjacentHTML('beforeend', `<style>
  #bd3-layer{position:fixed;inset:0;pointer-events:none;z-index:60;}
  .bd3-stage{position:absolute;perspective:900px;}
  .bd3-die{position:absolute;inset:0;transform-style:preserve-3d;}
  .bd3-face{position:absolute;inset:0;border-radius:20%;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;font-family:Inter,system-ui,sans-serif;font-weight:800;}
  .bd3-face.k{background:radial-gradient(circle at 30% 25%,#34314a,#16141f 60%,#0b0a12);color:#f2efe6;border:2px solid #5d5294;box-shadow:inset 0 0 12px rgba(0,0,0,.6);}
  .bd3-face.w{background:radial-gradient(circle at 30% 25%,#ffffff,#efe9dc 60%,#d6cfbd);color:#15131f;border:2px solid #b9b19c;box-shadow:inset 0 0 10px rgba(0,0,0,.18);}
  .bd3-shadow{position:absolute;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.6),rgba(0,0,0,0) 70%);}
  .bd3-fx{position:absolute;border-radius:50%;pointer-events:none;}
  .bfx.neu{background:#1d1c2c;border:1px solid #4a4766;} .bfx.neu .bfx-name,.bfx.neu .bfx-val{color:#cfc8ff;}
  .bd3-chip{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;font:800 13px/1 Inter,sans-serif;margin-right:8px;flex:none;}
  </style>`);
  let layer = null, curSeq = null; const thrown = {}, landAt = {}, acked = {};   // v1.1: landAt[seq] = { att, def } (ms) · acked[seq] = settled sent
  function getLayer() { if (!layer || !layer.isConnected) { layer = document.createElement('div'); layer.id = 'bd3-layer'; document.body.appendChild(layer); } return layer; }

  function buildDie(sz, white) {
    const die = document.createElement('div'); die.className = 'bd3-die'; const h = sz / 2;
    const faces = { 1: `translateZ(${h}px)`, 6: `rotateY(180deg) translateZ(${h}px)`, 3: `rotateY(90deg) translateZ(${h}px)`,
                    4: `rotateY(-90deg) translateZ(${h}px)`, 2: `rotateX(90deg) translateZ(${h}px)`, 5: `rotateX(-90deg) translateZ(${h}px)` };
    for (const v in faces) { const f = document.createElement('div'); f.className = 'bd3-face ' + (white ? 'w' : 'k'); f.style.transform = faces[v]; f.style.fontSize = Math.round(sz * .58) + 'px'; f.textContent = v; die.appendChild(f); }
    return die;
  }
  function fxCircle(x, y, css, kf, ms) {
    const e = document.createElement('div'); e.className = 'bd3-fx'; Object.assign(e.style, { left: x + 'px', top: y + 'px' }, css);
    getLayer().appendChild(e); e.animate(kf, { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => e.remove();
  }
  function jolt(px) {
    const r = document.getElementById('scale-root'); if (!r || !(px > 0)) return;
    try { r.animate([{ translate: '0 0' }, { translate: `${px}px ${-px * .6}px` }, { translate: `${-px * .7}px ${px * .4}px` }, { translate: `${px * .35}px 0` }, { translate: '0 0' }], { duration: 320, composite: 'add' }); } catch (e) {}
  }
  function landBeat(cx, cy, sz, v, white, col) {
    if (v === 1) return;   // a 1 lands dull: no ring (the thud is the stage squash)
    fxCircle(cx, cy, { width: sz + 'px', height: sz + 'px', marginLeft: -sz / 2 + 'px', marginTop: -sz / 2 + 'px', border: `3px solid ${col}`, boxSizing: 'border-box' },
             [{ transform: 'scale(.6)', opacity: .9 }, { transform: 'scale(2.1)', opacity: 0 }], 600);
    if (!DICE3D.critFx || v !== 6) return;
    if (!white) {   // Critical: gold burst + jolt
      fxCircle(cx, cy, { width: sz * 2 + 'px', height: sz * 2 + 'px', marginLeft: -sz + 'px', marginTop: -sz + 'px', background: 'radial-gradient(circle,rgba(255,215,122,.95),rgba(255,170,40,.35) 45%,rgba(255,170,40,0) 70%)' },
               [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: .8, offset: .35 }, { transform: 'scale(2.2)', opacity: 0 }], 700);
      jolt(7 * DICE3D.critJolt);
    } else {        // Braced: green shield pulse, twice
      [0, 160].forEach(d => setTimeout(() => fxCircle(cx, cy, { width: sz * 1.3 + 'px', height: sz * 1.3 + 'px', marginLeft: -sz * .65 + 'px', marginTop: -sz * .65 + 'px', border: '5px solid #7ee0a0', boxShadow: '0 0 18px #7ee0a0', boxSizing: 'border-box' },
               [{ transform: 'scale(.8)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 0 }], 650), d));
    }
  }
  function sound(kind, j) { try { if (kind === 'roll' && typeof _playDiceRoll === 'function') _playDiceRoll(); else if (kind === 'clack' && typeof SFX !== 'undefined' && SFX.diceClack) SFX.diceClack(j); } catch (e) {} }

  function throwDie(side, white, v, delay, col) {
    const D = DICE3D, k = kScale(), sz = Math.round(D.size * k);
    const a = document.querySelector('.bs-prev-att'), d = document.querySelector('.bs-prev-def'); if (!a || !d) return;
    const ra = a.getBoundingClientRect(), rd = d.getBoundingClientRect();
    const mx = (ra.left + ra.right + rd.left + rd.right) / 4, my = (ra.top + ra.bottom + rd.top + rd.bottom) / 4;
    const sp = SPOT[side], mid = [(sp.b[0] + sp.w[0]) / 2, (sp.b[1] + sp.w[1]) / 2], own = white ? sp.w : sp.b;
    const nx = side === 'att' ? D.attX : D.defX, ny = side === 'att' ? D.attY : D.defY;
    const lx = mx + (mid[0] + (own[0] - mid[0]) * D.spread + nx) * k, ly = my + (mid[1] + (own[1] - mid[1]) * D.spread + ny) * k;
    const stage = document.createElement('div'); stage.className = 'bd3-stage';
    Object.assign(stage.style, { left: (lx - sz / 2) + 'px', top: (ly - sz / 2) + 'px', width: sz + 'px', height: sz + 'px', opacity: 0 });
    const sh = document.createElement('div'); sh.className = 'bd3-shadow';
    Object.assign(sh.style, { width: sz * 1.25 + 'px', height: sz * .45 + 'px', left: -sz * .12 + 'px', top: sz * .78 + 'px' });
    const die = buildDie(sz, white); stage.appendChild(sh); stage.appendChild(die); getLayer().appendChild(stage);
    const [rx, ry] = FACE_ROT[v] || [0, 0], dir = side === 'att' ? 1 : -1;
    const sx = side === 'att' ? -(lx + sz * 2) : (innerWidth - lx + sz * 2), sy = (Math.random() * 120 - 60) * k;
    const spinX = (720 + 360 * Math.floor(Math.random() * 2)) * D.spin * (Math.random() < .5 ? 1 : -1), spinY = 1080 * D.spin * dir;
    const rz1 = (Math.random() * 2 - 1) * D.tilt, rz0 = rz1 + 220 * dir * D.spin, b = D.bounce;
    const T = (x, y, f, sc) => `translate(${x}px,${y}px) rotateZ(${rz0 + (rz1 - rz0) * f}deg) rotateX(${rx + spinX * (1 - f)}deg) rotateY(${ry + spinY * (1 - f)}deg) scale(${sc})`;
    const S = (x, y, h) => `translate(${x + h * 10 * k * dir}px,${y + h * 14 * k}px) scale(${1 - h * .35})`;
    const dur = reducedFx() ? 380 : D.throwMs;
    setTimeout(() => {
      if (!stage.isConnected) return;
      stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reducedFx() ? 300 : 120, fill: 'forwards' });
      if (reducedFx()) { die.style.transform = T(0, 0, 1, 1); return; }
      // top-down board: height reads as scale + shadow drift. Two bounces, a short skid, settle.
      const P = [[0, sx, sy, 0, 1 + .5 * b], [.42, sx * .30, sy * .30, .5, 1], [.56, sx * .16, sy * .15, .72, 1 + .16 * b], [.70, sx * .06, 0, .88, 1], [.80, sx * .025, 0, .95, 1 + .05 * b], [.90, sx * .005, 0, .99, 1], [1, 0, 0, 1, 1]];
      die.animate(P.map(([o, x, y, f, sc]) => ({ transform: T(x, y, f, sc), offset: o })), { duration: dur, easing: 'cubic-bezier(.25,.1,.3,1)', fill: 'forwards' });
      sh.animate(P.map(([o, x, y, f, sc]) => ({ transform: S(x, y, sc - 1), opacity: .35 + .65 * (1 - (sc - 1) * 2), offset: o })), { duration: dur, easing: 'cubic-bezier(.25,.1,.3,1)', fill: 'forwards' });
      [.42, .70, .90].forEach((f, j) => setTimeout(() => sound('clack', j), dur * f));
      setTimeout(() => {
        if (!stage.isConnected) return;
        if (v === 1) stage.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9,.84)' }, { transform: 'scale(1)' }], { duration: 220 });   // dull thud
        landBeat(lx, ly, sz, v, white, col);
      }, dur);
    }, delay);
  }
  function colOf(side) {
    try { const ai = G.currentPlayer, p = G.players.find(q => q.idx === ai) || G.players[ai];
      if (side === 'att') return p.color; const t = G.board[p.position]; const o = G.players.find(q => q.idx === t.ownerId); return (o && o.color) || '#c9a05a'; } catch (e) { return '#c9a05a'; }
  }
  function clearDice(fade) {
    const l = layer; if (!l || !l.children.length) return;
    [...l.querySelectorAll('.bd3-stage')].forEach(s => { if (fade) s.animate([{ opacity: getComputedStyle(s).opacity }, { opacity: 0 }], { duration: DICE3D.fadeMs, fill: 'forwards' }).onfinish = () => s.remove(); else s.remove(); });
    Object.keys(thrown).forEach(x => delete thrown[x]);
  }
  // v1.1: when both sides have landed, wait holdMs, then let the server start the fight (it falls back after 8 s on its own)
  function settle(R) {
    const L = landAt[R.seq]; if (!L || L.att == null || L.def == null || acked[R.seq]) return;
    acked[R.seq] = 1;
    const wait = Math.max(0, Math.max(L.att, L.def) - Date.now()) + DICE3D.holdMs, seq = R.seq;
    setTimeout(() => { try { if (G && G.battleRoll && G.battleRoll.seq === seq && typeof send === 'function') send('battle_dice_settled', { seq }); } catch (e) {} }, wait);
  }
  function sync() {
    const R0 = G && G.battleRoll;
    if (!DICE3D.on) {   // flat dice: they tumble ~0.65 s under the cards
      clearDice(false);
      if (R0 && G.phase === 'resolve:battle') { const L = landAt[R0.seq] || (landAt[R0.seq] = {}); ['att', 'def'].forEach(sd => { if (R0[sd] && L[sd] == null) L[sd] = Date.now() + 650; }); settle(R0); }
      return;
    }
    // the flat dice under the cards go; "Rolling…" stays for whoever has not rolled
    document.querySelectorAll('.bd-prev .bd-pair').forEach(e => e.remove());
    const R = G && G.battleRoll;
    if (!R || G.phase !== 'resolve:battle') { if (curSeq != null) { clearDice(true); curSeq = null; } return; }
    if (curSeq !== R.seq) { clearDice(false); curSeq = R.seq; }
    ['att', 'def'].forEach(side => {
      const r = R[side], key = R.seq + '|' + side; if (!r || thrown[key]) return;
      thrown[key] = 1; const col = colOf(side);
      (landAt[R.seq] || (landAt[R.seq] = {}))[side] = Date.now() + DICE3D.stagger + (reducedFx() ? 380 : DICE3D.throwMs);   // v1.1
      sound('roll');
      throwDie(side, false, r.b, 0, col);
      throwDie(side, true, r.w, DICE3D.stagger, col);
    });
    settle(R);
  }
  const prevRender = render;
  render = function () { const r = prevRender.apply(this, arguments); try { sync(); } catch (e) { console.warn('[dice3d]', e); } return r; };
  window.Dice3D = { sync, clear: () => { clearDice(false); curSeq = null; } };

  // ── fight: dice callouts on the outer edge of each card, one strike at a time ──
  let F = null;
  const prevFight = window._bdFight;
  window._bdFight = function (overlay, lb) {
    if (!DICE3D.on) { F = null; return prevFight && prevFight(overlay, lb); }
    const dz = lb && lb.dice; F = dz ? { overlay, dz, shown: {} } : null;
    if (!F) return;
    // the dice sit at the top of each callout column, abilities stack under them: top-align so nothing shifts as rows arrive
    ['#baAttFx', '#baDefFx'].forEach(s => { const c = overlay.querySelector(s); if (c && BATTLE_STAGE.fxPlace === 'side') { c.style.top = '22px'; c.style.bottom = 'auto'; c.style.transform = 'none'; } });
  };
  function row(white, v) {
    const t = TBL(), m = (white ? t.white : t.black)[v - 1], d = Math.round((m - 1) * 100);
    const word = white ? (v === 6 ? 'Braced' : v === 1 ? 'Exposed' : 'Defense') : (v === 6 ? 'Critical' : v === 1 ? 'Glancing' : 'Attack');   // v1.2: the phone's wording
    const tone = d === 0 ? 'neu' : white ? (d < 0 ? 'good' : 'bad') : (d > 0 ? 'good' : 'bad');
    const val = d === 0 ? 'no change' : (white ? 'takes ' : '') + (d > 0 ? '+' : '−') + Math.abs(d) + '%';
    const chip = `<span class="bd3-chip" style="${white ? 'background:#f2efe6;color:#15131f;border:2px solid #c9c4b4' : 'background:#15131f;color:#f2efe6;border:2px solid #5d5294'}">${v}</span>`;
    return `<div class="bfx ${tone} bd3-row"><div class="bfx-main" style="flex-direction:row;align-items:center">${chip}<div style="display:flex;flex-direction:column;gap:1px"><div class="bfx-name">${word}</div><div class="bfx-text">${white ? 'DEF' : 'ATK'} ×${m}</div></div></div><div class="bfx-val">${val}</div></div>`;
  }
  function put(colSel, white, v, key, delay, animate) {
    if (!F || F.shown[key]) return; F.shown[key] = 1;
    const col = F.overlay.querySelector(colSel); if (!col) return;
    let box = col.querySelector(':scope > .bd3-box'); if (!box) { box = document.createElement('div'); box.className = 'bd3-box'; box.style.cssText = 'display:flex;flex-direction:column;gap:6px'; col.prepend(box); }
    const go = () => { box.insertAdjacentHTML('beforeend', row(white, v)); const el = box.lastElementChild;
      if (animate && el) el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: DICE3D.coFadeMs, easing: 'ease-out', fill: 'backwards' }); };
    animate && delay ? setTimeout(go, delay) : go();
  }
  // board-battle.js calls this as each strike starts ('att' = attacker strikes, 'def' = defender strikes) and with 'all' to finish
  window._bdStrike = function (overlay, who) {
    if (!F || F.overlay !== overlay) return;
    const z = F.dz, all = who === 'all', anim = !all;
    if (who === 'att' || all) { put('#baAttFx', false, z.ab, 'ab', 0, anim); put('#baDefFx', true, z.dw, 'dw', DICE3D.coGap, anim); }
    if (who === 'def' || all) { put('#baDefFx', false, z.db, 'db', 0, anim); put('#baAttFx', true, z.aw, 'aw', DICE3D.coGap, anim); }
  };
})();

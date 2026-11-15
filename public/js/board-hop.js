// board-hop.js v1.1 (2026-11-14; v1.1 = IN THE GAME from board v0.6.92) — TOKEN HOP for Polish Plan stage 5.
// The token really jumps from tile to tile: a crouch, an arc with stretch and squash, a run that starts slow,
// speeds up through the middle and slows for the last tile, then a big landing.
// It sits on top of the board code: it replaces advanceTokenAnim() and adds a step after render().
// With TOKEN_HOP.mode = 'classic' (or Board Effects "Reduced") everything runs exactly as before.
// In the game since board v0.6.92 (loaded by board.html after board-render.js) with the user's settings below.
// Tuned in /hop-lab.html.
const TOKEN_HOP = {
  mode: 'arc',          // 'arc' = new hop · 'classic' = the game today (pop in on each tile, flat 230 ms)
  hopMs: 200,           // base time for one hop
  startMult: 1.5,       // first hop is this many times slower
  runMult: 0.7,         // middle hops
  endMult: 1.6,         // last hop
  maxTotalMs: 2600,     // a 12-tile move never takes longer than this (the game today: 2760)
  crouchMs: 140,        // wind-up before the first hop
  arcPx: 34,            // jump height
  finalArcMult: 1.5,    // the last jump is this much higher
  stretch: 0.12,        // stretch in the air
  squash: 0.14,         // squash on each touch-down
  leanDeg: 8,           // lean into the direction of travel
  landSquash: 0.3,      // the final landing
  landMs: 420,
  landShakePx: 3,       // tiny board bump on the final landing (0 = off)
  shadow: true,         // ground shadow under the jump
  tilePress: true,      // the tile reacts when the token lands on it (off = no tile reaction while hopping)
  pitchRamp: 0.5,       // footstep rises in pitch along the run (0 = same note every hop)
  timeScale: 1          // lab slow motion, never pinned
};
(function () {
  const S = TOKEN_HOP;
  const origAdvance = advanceTokenAnim, origRender = render;
  let cur = null;          // what the hopping token is doing right now: {kind:'crouch'|'flight'|'settle', pi, t0, dur, ...}
  const reduced = () => !!(window.BoardFX && BoardFX.level === 'reduced');
  const on = () => S.mode === 'arc' && !reduced();
  const ts = () => S.timeScale || 1;
  const tokEl = pi => { const l = document.getElementById('wheel-token-layer'); return l ? l.querySelectorAll('.player-token')[pi] : null; };
  const xy = el => (el && el.style.left) ? { x: parseFloat(el.style.left) + 70, y: parseFloat(el.style.top) + 140 } : null;

  // hop times: slow start, fast middle, slow finish, capped in total
  function plan(n) {
    const d = [];
    for (let i = 1; i <= n; i++) {
      const fs = i - 1, fe = n - i;
      const ws = fs === 0 ? 1 : fs === 1 ? 0.5 : 0, we = fe === 0 ? 1 : fe === 1 ? 0.5 : 0;
      d.push(Math.max(60, S.hopMs * (S.runMult + (Math.abs(ws * (S.startMult - S.runMult)) > Math.abs(we * (S.endMult - S.runMult)) ? ws * (S.startMult - S.runMult) : we * (S.endMult - S.runMult)))));
    }
    const sum = d.reduce((a, b) => a + b, 0), k = sum > S.maxTotalMs ? S.maxTotalMs / sum : 1;
    return d.map(v => v * k * ts());
  }

  let _ac = null;
  function step(i, n) {   // footstep
    if (!(S.pitchRamp > 0)) { SFX.tokenHop(); return; }
    try {
      const L = _sfxLvl(); if (L <= 0) return;
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      const f = 300 * (1 + S.pitchRamp * (n > 1 ? (i - 1) / (n - 1) : 0)), now = _ac.currentTime;
      [[f, 'sine', 0.085], [f * 2, 'triangle', 0.03]].forEach(([fr, type, vol]) => {
        const o = _ac.createOscillator(), g = _ac.createGain(); o.connect(g); g.connect(_ac.destination);
        o.type = type; o.frequency.setValueAtTime(fr, now);
        g.gain.setValueAtTime(0.001, now); g.gain.linearRampToValueAtTime(vol * L, now + 0.004); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        o.start(now); o.stop(now + 0.1);
      });
    } catch (e) {}
  }

  function advance() {
    if (!on()) return origAdvance();
    const A = boardTokenAnim; if (!A) return;
    if (!A._plan) {
      A._plan = plan(A.path.length - 1);
      if (A.path.length > 1 && S.crouchMs > 0) {
        cur = { kind: 'crouch', pi: A.playerIdx, t0: performance.now(), dur: S.crouchMs * ts() };
        apply();
        setTimeout(() => { if (boardTokenAnim === A) advance(); }, cur.dur);
        return;
      }
    }
    const from = xy(tokEl(A.playerIdx));
    A.step++;
    if (A.step >= A.path.length || !from) { finish(A); return; }
    const dur = A._plan[A.step - 1], final = A.step === A.path.length - 1;
    cur = { kind: 'flight', pi: A.playerIdx, from, t0: performance.now(), dur, final };
    render();                                   // the token is drawn on the next tile; apply() flies it there
    setTimeout(() => {
      if (boardTokenAnim !== A) return;
      if (final) { finish(A); return; }
      step(A.step, A.path.length - 1);
      _fxHop(A.path[A.step], false, A.playerIdx);
      advance();
    }, dur);
  }

  function finish(A) {
    const pi = A.playerIdx, fp = A.path[A.path.length - 1];
    boardTokenAnim = null;
    SFX.tokenArrive();
    if (G) { if (G.phase === 'resolve:battle') SFX.battleStart(); else if (G.phase === 'resolve:claim') SFX.claimTile(); }
    cur = { kind: 'settle', pi, t0: performance.now(), dur: S.landMs * ts() };
    render();
    _fxHop(fp, true, pi);
    if (S.landShakePx > 0) {
      const root = document.getElementById('scale-root'), p = S.landShakePx;
      try { root && root.animate([{ translate: '0px 0px' }, { translate: `0px ${p}px` }, { translate: `0px ${-p * 0.5}px` }, { translate: '0px 0px' }], { duration: 200 * ts(), easing: 'ease-out', composite: 'add' }); } catch (e) {}
    }
  }

  // (re)apply the current move to the token element. render() rebuilds the tokens, so this runs after every render
  // and picks the animation up at the right moment.
  function apply() {
    if (!cur) return;
    const now = performance.now(), t = now - cur.t0;
    if (cur.kind !== 'settle' && (!boardTokenAnim || boardTokenAnim.playerIdx !== cur.pi)) { cur = null; return; }
    if (cur.kind === 'settle' && t >= cur.dur) { cur = null; return; }
    const el = tokEl(cur.pi); if (!el) return;
    el.style.animation = 'none'; el.style.transformOrigin = '50% 100%';
    const o = { duration: Math.max(1, cur.dur), fill: 'both' };
    const run = (target, kf, opt) => { try { const a = target.animate(kf, Object.assign({}, o, opt || {})); a.currentTime = Math.min(t, cur.dur); return a; } catch (e) {} };
    const sq = S.squash, st = S.stretch;
    if (cur.kind === 'crouch') {
      run(el, [{ scale: '1 1' }, { scale: `${1 + sq} ${1 - sq}` }], { easing: 'ease-out' });
    } else if (cur.kind === 'flight') {
      const to = xy(el), dx = cur.from.x - to.x, dy = cur.from.y - to.y, H = S.arcPx * (cur.final ? S.finalArcMult : 1);
      const lean = S.leanDeg * (dx < 0 ? 1 : -1);
      el.style.zIndex = 30;
      run(el, { translate: [`${dx}px ${dy}px`, '0px 0px'] }, { easing: 'linear' });
      run(el, [{ transform: 'translateY(0px)', easing: 'cubic-bezier(.25,.46,.45,.94)' }, { transform: `translateY(${-H}px)`, easing: 'cubic-bezier(.55,.085,.68,.53)' }, { transform: 'translateY(0px)' }]);
      run(el, [{ scale: `${1 + sq} ${1 - sq}` }, { scale: `${1 - st * 0.6} ${1 + st}`, offset: 0.22 }, { scale: '1 1', offset: 0.5 }, { scale: `${1 - st * 0.5} ${1 + st * 0.8}`, offset: 0.85 }, { scale: `${1 + sq} ${1 - sq}` }]);
      if (S.leanDeg) run(el, [{ rotate: '0deg' }, { rotate: lean + 'deg', offset: 0.35 }, { rotate: '0deg' }]);
      if (S.shadow) {
        const layer = el.parentElement, sh = document.createElement('div');
        sh.className = 'hop-shadow';
        sh.style.cssText = `position:absolute;left:${to.x - 30}px;top:${to.y - 12}px;width:60px;height:16px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.55),rgba(0,0,0,0) 70%);pointer-events:none;`;
        layer.insertBefore(sh, layer.firstChild);
        run(sh, { translate: [`${dx}px ${dy}px`, '0px 0px'] }, { easing: 'linear' });
        run(sh, [{ scale: '1', opacity: 0.9 }, { scale: '0.55', opacity: 0.4, offset: 0.5 }, { scale: '1', opacity: 0.9 }]);
      }
      // the tile under the landing reacts when the token arrives, not when it takes off
      const body = document.querySelector('.tile.is-visiting .tile-body');
      if (body) { if (S.tilePress) body.style.animationDelay = Math.max(0, cur.dur - t - 50) + 'ms'; else body.style.animation = 'none'; }
    } else {   // settle: the final landing
      const L = S.landSquash;
      run(el, [{ scale: `${1 + L} ${1 - L}` }, { scale: `${1 - L * 0.35} ${1 + L * 0.45}`, offset: 0.35 }, { scale: `${1 + L * 0.15} ${1 - L * 0.15}`, offset: 0.65 }, { scale: '1 1' }], { easing: 'ease-out' });
    }
  }

  advanceTokenAnim = advance;
  render = function () {
    const r = origRender.apply(this, arguments);
    if (on()) {
      try {
        if (!cur && boardTokenAnim) { const el = tokEl(boardTokenAnim.playerIdx); if (el) el.style.animation = 'none'; }   // waiting for the dice: no pop on every redraw
        apply();
      } catch (e) { console.warn('[hop]', e); }
    }
    return r;
  };
  window.BoardHop = { plan, state: () => cur };
})();

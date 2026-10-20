/* ─────────────────────────────────────────────────────────────────────────────
 * Summoner's Gambit — board-fx.js  (v0.6.20, Tier 1–3 board interaction effects)
 *
 *  BoardFX.rollDice(anchorEl, dice, total, opts) → Promise (resolves when dice land)
 *  BoardFX.claim(tileInnerEl, { owner, elem, name })
 *  BoardFX.hop(tileInnerEl, { final, color, well })
 *  BoardFX.level / BoardFX.setLevel('full'|'reduced')
 *
 * All effects draw on one fixed overlay layer on <body>, so the board's render()
 * can rebuild the DOM underneath without cutting an effect off half-way.
 * Uses screen coordinates (getBoundingClientRect) so it works at any board scale.
 * ──────────────────────────────────────────────────────────────────────────── */
(function () {
  const LS_KEY = 'sg_fx_board';
  let level = 'full';
  try { const v = localStorage.getItem(LS_KEY); if (v === 'reduced' || v === 'full') level = v; } catch (e) {}
  try { if (!localStorage.getItem(LS_KEY) && matchMedia('(prefers-reduced-motion: reduce)').matches) level = 'reduced'; } catch (e) {}

  // ── Styles ────────────────────────────────────────────────────────────────
  const css = `
  #fx-layer{position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden;}
  .fx-abs{position:absolute;left:0;top:0;will-change:transform,opacity;}
  .fx-dice-stage{position:absolute;perspective:900px;}
  .fx-die{position:absolute;transform-style:preserve-3d;}
  .fx-die-face{position:absolute;inset:0;border-radius:18%;
    background:radial-gradient(circle at 30% 25%,#3b2d66 0%,#211741 55%,#140d2a 100%);
    border:2px solid #c9a05a;box-shadow:inset 0 0 14px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.06);
    display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:14%;box-sizing:border-box;backface-visibility:hidden;}
  .fx-pip{width:72%;height:72%;margin:auto;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,#ffe7b0,#e0b25a 55%,#a97b40);box-shadow:0 0 6px rgba(240,200,120,.75);}
  .fx-die-shadow{position:absolute;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.55),rgba(0,0,0,0) 70%);}
  .fx-ring{position:absolute;border-radius:50%;box-sizing:border-box;}
  .fx-spark{position:absolute;border-radius:50%;}
  .fx-chip{position:absolute;font-family:'Cinzel',serif;font-weight:700;letter-spacing:.12em;white-space:nowrap;
    padding:5px 12px;border-radius:999px;background:rgba(13,14,28,.9);border:2px solid currentColor;
    text-shadow:0 0 10px currentColor;box-shadow:0 0 18px currentColor;transform:translate(-50%,-50%);}
  .fx-doubles{position:absolute;font-family:'Cinzel',serif;font-weight:700;letter-spacing:.2em;color:#ffd77a;
    text-shadow:0 0 14px #c9a05a,0 0 30px #c9a05a;transform:translate(-50%,-50%);white-space:nowrap;}

  .fx-dim{position:absolute;inset:0;}
  .fx-streak{position:absolute;left:0;right:0;height:0;display:flex;align-items:center;justify-content:center;}
  .fx-streak-bar{position:absolute;left:0;right:0;height:100%;background:linear-gradient(90deg,transparent,#b0303088 18%,#e05252 50%,#b0303088 82%,transparent);box-shadow:0 0 40px #e05252;}
  .fx-streak-txt{position:relative;font-family:'Cinzel',serif;font-weight:700;letter-spacing:.32em;color:#fff;text-shadow:0 0 12px #e05252,0 0 30px #e05252,0 2px 0 #4a0d0d;white-space:nowrap;}
  .fx-streak-sub{position:absolute;font-family:'Cinzel',serif;font-weight:700;letter-spacing:.18em;white-space:nowrap;text-shadow:0 2px 8px #000;}
  .fx-banner{position:absolute;font-family:'Cinzel',serif;font-weight:700;letter-spacing:.2em;white-space:nowrap;transform:translate(-50%,-50%);
    text-shadow:0 0 14px currentColor,0 0 32px currentColor,0 2px 0 rgba(0,0,0,.6);}
  .fx-shard{position:absolute;}
  .fx-float{position:absolute;font-family:'Cinzel',serif;font-weight:700;white-space:nowrap;transform:translate(-50%,-50%);text-shadow:0 1px 0 rgba(0,0,0,.35),0 0 10px rgba(255,255,255,.6);}
  .fx-card{position:absolute;transform-style:preserve-3d;}
  .fx-card-face{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;padding:10px;text-align:center;}
  .fx-card-back{background:repeating-linear-gradient(45deg,#3a2a14,#3a2a14 6px,#4a361a 6px,#4a361a 12px);border:3px solid #c9a05a;transform:rotateY(180deg);}
  .fx-card-front{background:radial-gradient(circle at 50% 30%,#2a2048,#120c26);border:3px solid var(--rc,#c9a05a);box-shadow:0 0 30px var(--rc,#c9a05a);color:#e9e9ed;}
  .fx-card-icon{font-size:2.6em;line-height:1;filter:drop-shadow(0 0 10px var(--rc,#c9a05a));}
  .fx-card-title{font-family:'Cinzel',serif;font-weight:700;letter-spacing:.08em;font-size:1em;}
  .fx-card-sub{font-size:.72em;letter-spacing:.14em;text-transform:uppercase;color:var(--rc,#c9a05a);font-family:'Cinzel',serif;}
  .fx-ray{position:absolute;transform-origin:50% 100%;background:linear-gradient(to top,rgba(255,230,160,.55),rgba(255,230,160,0));}
  
  .fx-wc{position:absolute;transform-style:preserve-3d;}
  .fx-wc-face{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;overflow:hidden;box-sizing:border-box;}
  .fx-wc-front{border:3px solid var(--tc);box-shadow:0 0 40px var(--tc),inset 0 0 0 1px rgba(255,255,255,.1);background:#120c26 center/cover no-repeat;}
  .fx-wc-band{position:absolute;left:0;right:0;bottom:0;padding:10% 8% 8%;background:linear-gradient(to top,rgba(9,7,20,.96) 55%,rgba(9,7,20,0));text-align:center;}
  .fx-wc-name{font-family:'Cinzel',serif;font-weight:700;letter-spacing:.12em;color:#fff;text-shadow:0 0 12px var(--tc);font-size:1.25em;}
  .fx-wc-tier{font-family:'Cinzel',serif;letter-spacing:.3em;font-size:.6em;color:var(--tc);margin-bottom:4px;}
  .fx-wc-desc{font-size:.62em;line-height:1.35;color:#d8d8e4;margin-top:6px;font-family:Inter,sans-serif;}
  .fx-wc-back{transform:rotateY(180deg);border:3px solid var(--tc);background:radial-gradient(circle at 50% 50%,#2a2048 0,#120c26 70%);display:flex;align-items:center;justify-content:center;font-size:3.2em;color:var(--tc);text-shadow:0 0 20px var(--tc);}
  .fx-crown{position:absolute;transform:translate(-50%,-50%);line-height:1;filter:drop-shadow(0 0 8px #ffd77a) drop-shadow(0 2px 2px rgba(0,0,0,.5));}
    `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function layer() {
    let l = document.getElementById('fx-layer');
    if (!l) { l = document.createElement('div'); l.id = 'fx-layer'; document.body.appendChild(l); }
    return l;
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  function mk(cls, styles) {
    const d = document.createElement('div'); d.className = cls;
    if (styles) Object.assign(d.style, styles);
    layer().appendChild(d); return d;
  }
  function done(anim, el) { anim.onfinish = () => el.remove(); anim.oncancel = () => el.remove(); return anim; }
  // Board scale factor (the board is a 1440×900 canvas scaled to the screen)
  function scale() {
    const root = document.getElementById('scale-root');
    if (!root) return 1;
    const r = root.getBoundingClientRect();
    return r.width / 1440 || 1;
  }

  // ── Shared primitives ─────────────────────────────────────────────────────
  function ring(x, y, size, color, { dur = 700, delay = 0, grow = 4, width = 4 } = {}) {
    const d = mk('fx-ring', { width: size + 'px', height: size + 'px', left: (x - size / 2) + 'px', top: (y - size / 2) + 'px',
      border: `${width}px solid ${color}`, boxShadow: `0 0 18px ${color}, inset 0 0 12px ${color}`, opacity: 0 });
    return done(d.animate([
      { transform: 'scale(.2)', opacity: 0 },
      { transform: 'scale(.6)', opacity: 1, offset: .15 },
      { transform: `scale(${grow})`, opacity: 0 }
    ], { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }), d);
  }
  function sparks(x, y, color, n, dist, { dur = 750, size = 6, delay = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .5;
      const r = dist * (.6 + Math.random() * .6);
      const s = size * (.6 + Math.random() * .8);
      const d = mk('fx-spark', { width: s + 'px', height: s + 'px', left: (x - s / 2) + 'px', top: (y - s / 2) + 'px',
        background: color, boxShadow: `0 0 ${s * 2}px ${color}`, opacity: 0 });
      done(d.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }
      ], { duration: dur * (.8 + Math.random() * .4), delay, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'both' }), d);
    }
  }
  function glow(el, color, dur = 900) {
    if (!el || !el.animate) return;
    el.animate([
      { boxShadow: `0 0 0 0 ${color}00`, filter: 'brightness(1)' },
      { boxShadow: `0 0 0 5px ${color}, 0 0 34px ${color}`, filter: 'brightness(1.6)', offset: .25 },
      { boxShadow: `0 0 0 0 ${color}00`, filter: 'brightness(1)' }
    ], { duration: dur, easing: 'ease-out' });
  }

  // ── 3D dice ───────────────────────────────────────────────────────────────
  // Face layout: front=1, back=6, right=3, left=4, top=2, bottom=5
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
  function buildDie(sz) {
    const die = document.createElement('div'); die.className = 'fx-die';
    die.style.width = die.style.height = sz + 'px';
    const h = sz / 2;
    const faces = { 1: `translateZ(${h}px)`, 6: `rotateY(180deg) translateZ(${h}px)`, 3: `rotateY(90deg) translateZ(${h}px)`,
                    4: `rotateY(-90deg) translateZ(${h}px)`, 2: `rotateX(90deg) translateZ(${h}px)`, 5: `rotateX(-90deg) translateZ(${h}px)` };
    for (const v in faces) {
      const f = document.createElement('div'); f.className = 'fx-die-face'; f.style.transform = faces[v];
      for (let i = 0; i < 9; i++) { const c = document.createElement('div'); if (PIPS[v].includes(i)) c.className = 'fx-pip'; f.appendChild(c); }
      die.appendChild(f);
    }
    return die;
  }

  /**
   * Two dice tumble in, bounce, settle on their faces either side of anchorEl.
   * opts: { color, tick(), land(), doubles:boolean auto, holdMs }
   * Resolves when the dice have landed (caller then reveals the total).
   * Dice fade out on their own after holdMs.
   */
  function rollDice(anchorEl, dice, total, opts = {}) {
    return new Promise(resolve => {
      if (!anchorEl || !Array.isArray(dice) || dice.length !== 2) { resolve(); return; }
      const c = center(anchorEl), k = scale();
      const sz = Math.round(78 * k), gap = Math.round(118 * k);
      const reduced = level === 'reduced';
      const dur = reduced ? 700 : 1250;
      const holdMs = opts.holdMs || 2300;
      const els = [];
      dice.forEach((v, i) => {
        const side = i === 0 ? -1 : 1;
        const fx = c.x + side * gap, fy = c.y;
        const stage = mk('fx-dice-stage', { opacity: 0, left: (fx - sz / 2) + 'px', top: (fy - sz / 2) + 'px', width: sz + 'px', height: sz + 'px' });
        const shadow = document.createElement('div'); shadow.className = 'fx-die-shadow';
        Object.assign(shadow.style, { width: sz * 1.2 + 'px', height: sz * .35 + 'px', left: (-sz * .1) + 'px', top: (sz * .9) + 'px' });
        stage.appendChild(shadow);
        const die = buildDie(sz); stage.appendChild(die); els.push(stage);
        const [rx, ry] = FACE_ROT[v] || [0, 0];
        const spinX = (reduced ? 360 : 720 + Math.floor(Math.random() * 2) * 360) * (Math.random() < .5 ? 1 : -1);
        const spinY = (reduced ? 360 : 1080) * side;
        const sx = side * (260 + Math.random() * 80) * k, sy = -(300 + Math.random() * 60) * k;
        // Every keyframe uses the same function list so the browser interpolates the
        // rotations numerically (multi-turn spins) instead of collapsing to a matrix.
        const T = (x, y, f, sc = 1) => `translate(${x}px,${y}px) rotateX(${rx + spinX * (1 - f)}deg) rotateY(${ry + spinY * (1 - f)}deg) scale(${sc})`;
        // Arc in, two bounces, settle
        die.animate(reduced ? [
          { transform: T(sx * .4, sy * .4, 0) },
          { transform: T(0, 0, 1) }
        ] : [
          { transform: T(sx, sy, 0, 1.15), offset: 0 },
          { transform: T(sx * .35, sy * .1, .45, 1.05), offset: .38 },
          { transform: T(sx * .08, 0, .75), offset: .58 },          // bounce 1 (floor)
          { transform: T(sx * .03, -38 * k, .9), offset: .72 },
          { transform: T(0, 0, .98), offset: .86 },                  // bounce 2
          { transform: T(0, -9 * k, 1), offset: .93 },
          { transform: T(0, 0, 1), offset: 1 }
        ], { duration: dur + i * 90, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
        // Fade on the stage, never on the die: opacity on a preserve-3d element flattens it to 2D
        stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * .3, fill: 'forwards' });
        shadow.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: dur * .6, fill: 'forwards' });
      });
      // Sound ticks on the bounces
      // v0.6.01: rolling sound — rattle while tumbling, hard clacks on each bounce
      const call = (fn, a) => { try { fn && fn(a); } catch (e) {} };
      for (let t = 40; t < dur * .55; t += 55 + Math.random() * 35) setTimeout(() => call(opts.rattle, Math.random()), t);
      (reduced ? [.95] : [.58, .86, .95]).forEach((f, j) => setTimeout(() => call(opts.clack, j), dur * f));
      setTimeout(() => {
        try { opts.land && opts.land(); } catch (e) {}
        const isDouble = dice[0] === dice[1];
        if (!reduced) {
          els.forEach(s => { const r = s.getBoundingClientRect(); ring(r.left + r.width / 2, r.top + r.height / 2, sz, opts.color || '#c9a05a', { dur: 600, grow: 2.2, width: 3 }); });
        }
        if (isDouble) {
          const d = mk('fx-doubles', { left: c.x + 'px', top: (c.y - 92 * k) + 'px', fontSize: Math.round(26 * k) + 'px', opacity: 0 });
          d.textContent = 'DOUBLES!';
          done(d.animate([
            { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1, offset: .18 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .3 },
            { transform: 'translate(-50%,-60%) scale(1)', opacity: 1, offset: .85 },
            { transform: 'translate(-50%,-70%) scale(1)', opacity: 0 }
          ], { duration: 1900, easing: 'ease-out', fill: 'both' }), d);
          if (!reduced) sparks(c.x, c.y - 92 * k, '#ffd77a', 18, 120 * k, { dur: 900 });
          try { opts.doubles && opts.doubles(); } catch (e) {}
        }
        resolve();
        // Fade the dice out after the hold
        setTimeout(() => els.forEach(s => done(s.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.7)' }],
          { duration: 350, easing: 'ease-in', fill: 'forwards' }), s)), holdMs);
      }, dur + 90);
    });
  }

  // ── Tile claim fanfare ────────────────────────────────────────────────────
  // tileInner: the .tile-inner element; badge: the .tile-badge (summon card) if any
  function claim(tileInner, { owner = '#9184d9', elem = '#c9a05a', name = '', badge = null } = {}) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale();
    const reduced = level === 'reduced';
    // v0.6.01: the card lands on the board just inside the tile (toward the centre),
    // squashes, then slides out into its slot. Badge lives inside the rotated tile,
    // so local +Y always points at the board centre.
    const IN = 78;                                   // local px inward
    const wc = document.querySelector('.wheel-center');
    let lx = c.x, ly = c.y;                          // landing point in screen coords
    if (wc) { const w = center(wc); const dx = w.x - c.x, dy = w.y - c.y, L = Math.hypot(dx, dy) || 1;
      lx = c.x + dx / L * IN * k; ly = c.y + dy / L * IN * k; }
    // v0.6.02: .tile-badge is centred with CSS translateX(-50%) — every keyframe must keep it,
    // otherwise the card animates off-centre and snaps when the animation ends.
    if (badge && badge.animate) {
      badge.animate(reduced ? [
        { transform: `translateX(-50%) translateY(${IN}px) scale(1)`, opacity: 0 },
        { transform: `translateX(-50%) translateY(${IN}px) scale(1)`, opacity: 1, offset: .3 },
        { transform: 'translateX(-50%) translateY(0) scale(1)', opacity: 1 }
      ] : [
        { transform: `translateX(-50%) translateY(${IN}px) scale(1.8)`, opacity: 0, filter: 'brightness(2)', offset: 0 },
        { transform: `translateX(-50%) translateY(${IN}px) scale(1.12, .84)`, opacity: 1, filter: 'brightness(1.6)', offset: .32 },   // lands
        { transform: `translateX(-50%) translateY(${IN}px) scale(.96, 1.05)`, offset: .42 },
        { transform: `translateX(-50%) translateY(${IN}px) scale(1)`, filter: 'brightness(1.2)', offset: .55 },                       // beat
        { transform: 'translateX(-50%) translateY(-8px) scale(1)', offset: .86 },                                                    // slide out, overshoot
        { transform: 'translateX(-50%) translateY(0) scale(1)', filter: 'brightness(1)' }
      ], { duration: reduced ? 500 : 1050, easing: 'cubic-bezier(.3,.6,.4,1)' });
    }
    if (!reduced) setTimeout(() => {               // landing thump on the board
      ring(lx, ly, 46 * k, elem, { dur: 550, grow: 2.6, width: 3 });
      sparks(lx, ly, 'rgba(230,215,180,.85)', 10, 50 * k, { dur: 500, size: 5 });
    }, 340);
    const impact = reduced ? 300 : 920; // main shockwave when the card seats in its slot
    setTimeout(() => {
      glow(tileInner, owner, 1100);
      ring(c.x, c.y, 60 * k, elem, { dur: reduced ? 600 : 900, grow: reduced ? 2.5 : 5.5, width: 5 });
      if (!reduced) {
        ring(c.x, c.y, 60 * k, owner, { dur: 1000, delay: 120, grow: 4, width: 3 });
        sparks(c.x, c.y, elem, 16, 110 * k, { dur: 800, size: 7 });
        sparks(c.x, c.y, owner, 10, 80 * k, { dur: 700, size: 5, delay: 80 });
      }
      // "+1 TILE" chip floats up
      const chip = mk('fx-chip', { left: c.x + 'px', top: (c.y - 50 * k) + 'px', color: owner, fontSize: Math.round(13 * k) + 'px', opacity: 0 });
      chip.textContent = name ? `+1 TILE · ${name}` : '+1 TILE';
      done(chip.animate([
        { transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1, offset: .15 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .25 },
        { transform: `translate(-50%,calc(-50% - ${70 * k}px)) scale(1)`, opacity: 0 }
      ], { duration: 1700, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' }), chip);
    }, impact);
  }

  // ── Token hop / landing ───────────────────────────────────────────────────
  function hop(tileInner, { final = false, color = '#c9a05a', well = false } = {}) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale();
    const reduced = level === 'reduced';
    if (well) {                                       // passing the Mana Well — gold shimmer
      ring(c.x, c.y, 50 * k, '#ffd77a', { dur: 800, grow: 3, width: 3 });
      if (!reduced) sparks(c.x, c.y, '#ffd77a', 14, 90 * k, { dur: 900, size: 5 });
    }
    if (final) {
      glow(tileInner, color, 1000);
      ring(c.x, c.y, 50 * k, color, { dur: 750, grow: 3.4, width: 4 });
      if (!reduced) sparks(c.x, c.y + 20 * k, 'rgba(230,215,180,.85)', 10, 55 * k, { dur: 600, size: 6 }); // dust
    } else if (!reduced) {
      ring(c.x, c.y + 18 * k, 26 * k, 'rgba(230,215,180,.55)', { dur: 380, grow: 2.2, width: 2 });     // dust puff
    }
  }

  // ── Ring ripple (v0.6.02) ─────────────────────────────────────────────────
  // tiles: array of tile elements indexed by board position; origin: position the wave starts from.
  // Each tile kicks outward (local -Y) with an overshoot, staggered around the ring both ways.
  // composite:'add' stacks on top of the tile's own rotate/translate transform.
  function ripple(tiles, origin = 0, { step = 24, lift = 18 } = {}) {
    if (level === 'reduced' || !tiles || !tiles.length) return;
    const N = tiles.length;
    tiles.forEach((el, i) => {
      if (!el || !el.animate) return;
      const d = Math.min((i - origin + N) % N, (origin - i + N) % N);
      try {
        el.animate([
          { transform: 'translateY(0px) scale(1)' },
          { transform: `translateY(${-lift}px) scale(1.06)`, offset: .35 },
          { transform: `translateY(${lift * .25}px) scale(.98)`, offset: .7 },
          { transform: 'translateY(0px) scale(1)' }
        ], { duration: 560, delay: d * step, easing: 'cubic-bezier(.3,.7,.4,1)', composite: 'add' });
      } catch (e) {}
    });
  }

    // ═══════════════════════════ Tier 2 (v0.6.10) ═══════════════════════════
  function boardCenter() {
    const wc = document.querySelector('.wheel-center');
    if (wc) return center(wc);
    return { x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0 };
  }
  function banner(x, y, text, color, { size = 30, dur = 1500, rise = 40, delay = 0 } = {}) {
    const k = scale();
    const d = mk('fx-banner', { left: x + 'px', top: y + 'px', color, fontSize: Math.round(size * k) + 'px', opacity: 0 });
    d.textContent = text;
    return done(d.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 1, offset: .14 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .26 },
      { transform: `translate(-50%,calc(-50% - ${rise * .5 * k}px)) scale(1)`, opacity: 1, offset: .8 },
      { transform: `translate(-50%,calc(-50% - ${rise * k}px)) scale(1)`, opacity: 0 }
    ], { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }), d);
  }
  function shake(px = 6, dur = 380) {
    if (level === 'reduced') return;
    const root = document.getElementById('scale-root'); if (!root) return;
    const f = []; for (let i = 0; i < 8; i++) f.push({ translate: `${(Math.random() * 2 - 1) * px}px ${(Math.random() * 2 - 1) * px}px` });
    f.push({ translate: '0px 0px' });
    try { root.animate(f, { duration: dur, easing: 'linear', composite: 'add' }); } catch (e) {}
  }

  // ⚔ Battle lead-in: board dims except the contested tile, a red streak slams across.
  function challenge(tileInner, { att = '#e05252', def = '#5ca8e0', attName = '', defName = '' } = {}) {
    const c = tileInner && tileInner.isConnected ? center(tileInner) : boardCenter();
    const k = scale(), bc = boardCenter(), reduced = level === 'reduced';
    const R = 95 * k;
    const dim = mk('fx-dim', { background: `radial-gradient(circle at ${c.x}px ${c.y}px, transparent ${R}px, rgba(5,4,14,.72) ${R * 1.9}px)`, opacity: 0 });
    done(dim.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0 }],
      { duration: reduced ? 1000 : 1500, easing: 'ease-in-out', fill: 'both' }), dim);
    ring(c.x, c.y, 70 * k, '#e05252', { dur: 900, grow: 3.2, width: 5, delay: 150 });
    const h = Math.round(64 * k);
    const W = 1000 * k;   // centred on the board, not the whole screen
    const st = mk('fx-streak', { top: (bc.y - h / 2) + 'px', height: h + 'px', left: (bc.x - W / 2) + 'px', right: 'auto', width: W + 'px', opacity: 0, overflow: 'visible' });
    st.innerHTML = `<div class="fx-streak-bar"></div><div class="fx-streak-txt" style="font-size:${Math.round(34 * k)}px">⚔ CHALLENGE ⚔</div>` +
      (attName && defName ? `<div class="fx-streak-sub" style="top:${h + 6 * k}px;font-size:${Math.round(19 * k)}px"><span style="color:${att}">${attName}</span> <span style="color:#fff">vs</span> <span style="color:${def}">${defName}</span></div>` : '');
    done(st.animate([
      { transform: 'translateX(-110%) skewX(-20deg)', opacity: 1 },
      { transform: 'translateX(4%) skewX(-8deg)', opacity: 1, offset: .14 },
      { transform: 'translateX(0) skewX(0)', opacity: 1, offset: .2 },
      { transform: 'translateX(0) scale(1.02)', opacity: 1, offset: .75 },
      { transform: 'translateX(110%) skewX(20deg)', opacity: 0 }
    ], { duration: reduced ? 1000 : 1500, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }), st);
    setTimeout(() => shake(5, 300), 210);
  }

  // 🏳 Takeover: old owner's colour shatters off the tile, new colour sweeps in.
  function takeover(tileInner, { from = '#5ca8e0', to = '#e05252', name = '' } = {}) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale(), reduced = level === 'reduced';
    if (!reduced) for (let i = 0; i < 14; i++) {           // shards of the old colour
      const a = Math.random() * Math.PI * 2, r = (60 + Math.random() * 90) * k, w = (6 + Math.random() * 10) * k, hh = (10 + Math.random() * 16) * k;
      const d = mk('fx-shard', { left: (c.x - w / 2) + 'px', top: (c.y - hh / 2) + 'px', width: w + 'px', height: hh + 'px', background: from,
        boxShadow: `0 0 8px ${from}`, clipPath: 'polygon(50% 0,100% 40%,70% 100%,0 70%)' });
      done(d.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r + 40 * k}px) rotate(${(Math.random() * 2 - 1) * 540}deg)`, opacity: 0 }
      ], { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' }), d);
    }
    tileInner.animate([
      { boxShadow: `0 0 0 4px ${from}, 0 0 24px ${from}`, filter: 'brightness(1.5) saturate(.4)' },
      { boxShadow: `0 0 0 0 ${from}00`, filter: 'brightness(.6) saturate(0)', offset: .3 },
      { boxShadow: `0 0 0 6px ${to}, 0 0 40px ${to}`, filter: 'brightness(1.8)', offset: .6 },
      { boxShadow: `0 0 0 0 ${to}00`, filter: 'brightness(1)' }
    ], { duration: 1400, easing: 'ease-out' });
    setTimeout(() => {
      ring(c.x, c.y, 60 * k, to, { dur: 900, grow: 5, width: 5 });
      if (!reduced) sparks(c.x, c.y, to, 16, 110 * k, { dur: 800, size: 7 });
      banner(c.x, c.y - 70 * k, name ? `CONQUERED · ${name}` : 'CONQUERED', to, { size: 18, dur: 1700 });
    }, 420);
  }
  // 🛡 Defence held: shield pulse in the defender's colour.
  function held(tileInner, { color = '#5ca8e0', name = '' } = {}) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale();
    glow(tileInner, color, 1200);
    ring(c.x, c.y, 80 * k, color, { dur: 650, grow: 1.6, width: 8 });
    ring(c.x, c.y, 80 * k, '#ffffff', { dur: 800, grow: 2.4, width: 3, delay: 120 });
    banner(c.x, c.y - 70 * k, name ? `HELD! · ${name}` : 'HELD!', color, { size: 20, dur: 1600 });
  }
  // 💥 Mutual destruction / stalemate
  function clash(tileInner, { a = '#e05252', b = '#5ca8e0', text = 'DOUBLE KO' } = {}) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale(), reduced = level === 'reduced';
    ring(c.x, c.y, 60 * k, a, { dur: 800, grow: 4, width: 5 });
    ring(c.x, c.y, 60 * k, b, { dur: 800, grow: 4, width: 5, delay: 100 });
    if (!reduced) { sparks(c.x, c.y, a, 10, 100 * k); sparks(c.x, c.y, b, 10, 100 * k, { delay: 80 }); }
    banner(c.x, c.y - 70 * k, text, '#ffd77a', { size: 18, dur: 1500 });
    if (text === 'DOUBLE KO') shake(6, 360);
  }

  // ✦ Mana: rolling counter + floating delta. State persists across re-renders by player index.
  const _roll = {};
  function manaRoll(idx, el, value) {
    if (!el) return;
    const st = _roll[idx];
    if (value == null) { el.textContent = st ? st.shown : ''; if (st) st.el = el; return; }   // hold (board busy)
    if (st == null) { _roll[idx] = { shown: value, to: value }; el.textContent = value; return; }
    if (st.to !== value) {                                // new change: tween from what is on screen now
      st.from = st.shown; st.to = value; st.t0 = performance.now();
      st.dur = Math.min(1100, 450 + Math.abs(value - st.from) * 18);
    }
    st.el = el;
    el.textContent = st.shown;
    if (st.raf || st.shown === st.to) { if (st.shown === st.to) el.textContent = st.to; return; }
    const step = (t) => {
      const f = Math.min(1, (t - st.t0) / st.dur), e = 1 - Math.pow(1 - f, 3);
      st.shown = Math.round(st.from + (st.to - st.from) * e);
      if (st.el && st.el.isConnected) st.el.textContent = st.shown;
      if (f < 1) st.raf = requestAnimationFrame(step); else { st.raf = 0; st.shown = st.to; if (st.el) st.el.textContent = st.to; }
    };
    st.raf = requestAnimationFrame(step);
  }
  function manaFloat(el, delta) {
    if (!el || !el.isConnected || !delta) return;
    const c = center(el), k = scale();
    const up = delta > 0, col = up ? '#3a9a52' : '#c0392b';
    const d = mk('fx-float', { left: (c.x - 34 * k) + 'px', top: c.y + 'px', color: col, fontSize: Math.round((Math.abs(delta) >= 20 ? 20 : 16) * k) + 'px', opacity: 0 });
    d.textContent = (up ? '+' : '−') + Math.abs(delta) + '✦';
    done(d.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1, offset: .15 },
      { transform: `translate(-50%,calc(-50% - ${(up ? 26 : -18) * k}px)) scale(1)`, opacity: 0 }
    ], { duration: 1300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }), d);
    try { el.closest('.player-chip')?.animate([{ filter: `drop-shadow(0 0 0 ${col})` }, { filter: `drop-shadow(0 0 8px ${col})`, offset: .3 }, { filter: `drop-shadow(0 0 0 ${col})` }], { duration: 900 }); } catch (e) {}
  }
  // Coins arc from one panel to another (battle payouts, steals, drains)
  function flow(fromEl, toEl, { color = '#ffd77a', n = 8 } = {}) {
    if (level === 'reduced' || !fromEl || !toEl || !fromEl.isConnected || !toEl.isConnected) return;
    const a = center(fromEl), b = center(toEl), k = scale();
    for (let i = 0; i < n; i++) {
      const s = (8 + Math.random() * 4) * k;
      const d = mk('fx-spark', { width: s + 'px', height: s + 'px', left: (a.x - s / 2) + 'px', top: (a.y - s / 2) + 'px',
        background: `radial-gradient(circle at 35% 30%,#fff3c4,${color} 60%,#a97b40)`, boxShadow: `0 0 10px ${color}`, opacity: 0 });
      const dx = b.x - a.x, dy = b.y - a.y, arc = -40 * k - Math.random() * 30 * k;
      done(d.animate([
        { transform: 'translate(0,0) scale(.6)', opacity: 0 },
        { transform: `translate(${dx * .5 + (Math.random() * 20 - 10) * k}px,${dy * .5 + arc}px) scale(1.1)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: .2 }
      ], { duration: 700 + Math.random() * 200, delay: i * 55, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' }), d);
    }
  }

  // 📦 Chest: lid burst, a reward card flips out and floats over the board centre.
  function chest(tileInner, { icon = '🎁', title = 'Treasure', sub = 'Common', color = '#c9a05a' } = {}) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale(), bc = boardCenter(), reduced = level === 'reduced';
    ring(c.x, c.y, 50 * k, '#ffd77a', { dur: 700, grow: 3.5, width: 4 });
    if (!reduced) sparks(c.x, c.y, '#ffd77a', 22, 130 * k, { dur: 900, size: 7 });
    const w = 150 * k, h = 200 * k;
    const tx = bc.x + (c.x - bc.x) * .35, ty = bc.y + (c.y - bc.y) * .35;   // a third of the way in
    const card = mk('fx-card', { left: (c.x - w / 2) + 'px', top: (c.y - h / 2) + 'px', width: w + 'px', height: h + 'px', fontSize: Math.round(16 * k) + 'px' });
    card.style.setProperty('--rc', color);
    card.innerHTML = `<div class="fx-card-face fx-card-front"><div class="fx-card-icon">${icon}</div><div class="fx-card-title">${title}</div><div class="fx-card-sub">${sub}</div></div><div class="fx-card-face fx-card-back"></div>`;
    const wrap = mk('fx-dice-stage', { left: 0, top: 0, width: '100%', height: '100%', perspective: '900px' });
    wrap.appendChild(card);
    const dx = tx - c.x, dy = ty - c.y;
    // fade the wrapper, never the 3D card
    done(wrap.animate([{ opacity: 0 }, { opacity: 1, offset: .06 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: 3000, fill: 'both' }), wrap);
    card.animate([
      { transform: 'translate(0,0) rotateY(180deg) scale(.25)' },
      { transform: `translate(${dx * .6}px,${dy * .6 - 60 * k}px) rotateY(180deg) scale(.9)`, offset: .18 },
      { transform: `translate(${dx}px,${dy}px) rotateY(0deg) scale(1.08)`, offset: .34 },
      { transform: `translate(${dx}px,${dy}px) rotateY(0deg) scale(1)`, offset: .42 },
      { transform: `translate(${dx}px,${dy - 10 * k}px) rotateY(0deg) scale(1)`, offset: .88 },
      { transform: `translate(${dx}px,${dy - 30 * k}px) rotateY(0deg) scale(.9)` }
    ], { duration: 3000, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'forwards' });
    setTimeout(() => { const r = { x: c.x + dx, y: c.y + dy }; ring(r.x, r.y, 120 * k, color, { dur: 800, grow: 2, width: 3 }); }, 1000);
  }
  // 🏛 Temple: god-rays fan out of the tile.
  function temple(tileInner) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale(), reduced = level === 'reduced';
    const n = reduced ? 6 : 12, L = 190 * k;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 360, w = (14 + (i % 3) * 8) * k;
      const d = mk('fx-ray', { left: (c.x - w / 2) + 'px', top: (c.y - L) + 'px', width: w + 'px', height: L + 'px', opacity: 0 });
      done(d.animate([
        { transform: `rotate(${ang}deg) scaleY(.1)`, opacity: 0 },
        { transform: `rotate(${ang + 8}deg) scaleY(1)`, opacity: .9, offset: .35 },
        { transform: `rotate(${ang + 20}deg) scaleY(1.1)`, opacity: 0 }
      ], { duration: 2000, delay: i * 25, easing: 'ease-out', fill: 'both' }), d);
    }
    glow(tileInner, '#ffe6a0', 1600);
    banner(c.x, c.y - 80 * k, 'THE TEMPLE', '#ffe6a0', { size: 18, dur: 1900 });
  }
  // 💚 Heal: green motes rise from the tile, "+N" floats up.
  function heal(tileInner, amount = 0) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale(), reduced = level === 'reduced';
    glow(tileInner, '#5dc97d', 900);
    if (!reduced) for (let i = 0; i < 8; i++) {
      const s = (5 + Math.random() * 5) * k, x = c.x + (Math.random() * 2 - 1) * 26 * k;
      const d = mk('fx-spark', { width: s + 'px', height: s + 'px', left: x + 'px', top: (c.y + 20 * k) + 'px', background: '#7dffa0', boxShadow: '0 0 10px #5dc97d', opacity: 0 });
      done(d.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .2 }, { transform: `translateY(${-70 * k}px)`, opacity: 0 }],
        { duration: 1000 + Math.random() * 400, delay: i * 60, easing: 'ease-out', fill: 'both' }), d);
    }
    if (amount > 0) {
      const d = mk('fx-float', { left: c.x + 'px', top: (c.y - 20 * k) + 'px', color: '#5dc97d', fontSize: Math.round(15 * k) + 'px', opacity: 0 });
      d.textContent = `+${amount} HP`;
      done(d.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 1, offset: .2 },
        { transform: `translate(-50%,calc(-50% - ${40 * k}px)) scale(1)`, opacity: 0 }], { duration: 1300, fill: 'both' }), d);
    }
  }
  // ✦ Mana Well: fountain of gold.
  function well(tileInner, amount = 40) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale(), reduced = level === 'reduced';
    glow(tileInner, '#ffd77a', 1400);
    ring(c.x, c.y, 50 * k, '#ffd77a', { dur: 900, grow: 4, width: 5 });
    const n = reduced ? 10 : 34;
    for (let i = 0; i < n; i++) {
      const s = (5 + Math.random() * 6) * k, vx = (Math.random() * 2 - 1) * 90 * k, top = (120 + Math.random() * 80) * k;
      const d = mk('fx-spark', { width: s + 'px', height: s + 'px', left: c.x + 'px', top: c.y + 'px',
        background: 'radial-gradient(circle at 35% 30%,#fff3c4,#ffd77a 60%,#a97b40)', boxShadow: '0 0 10px #ffd77a', opacity: 0 });
      done(d.animate([
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${vx * .5}px,${-top}px)`, opacity: 1, offset: .45 },
        { transform: `translate(${vx}px,${-top * .25}px)`, opacity: 0 }
      ], { duration: 1200 + Math.random() * 400, delay: Math.random() * 350, easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'both' }), d);
    }
    banner(c.x, c.y - 90 * k, `+${amount}✦ MANA WELL`, '#ffd77a', { size: 20, dur: 1800 });
  }


  // ═══════════════════════════ Tier 3 (v0.6.20) ═══════════════════════════
  const TIER = { low: { c: '#b8c6d6', label: 'IRON' }, mid: { c: '#8fa2ff', label: 'ARCANE' }, high: { c: '#ffd77a', label: 'GILDED' } };

  // 🃏 Wild Card: the card flies from the caster's panel to the board centre, flips, holds, then
  // flies to its target(s). Gilded cards land with a shockwave + shake.
  // targets: array of elements (tile-inner or chip). Resolves when the card reaches its target.
  function wildCard(card, fromEl, targets = [], opts = {}) {
    return new Promise(resolve => {
      const k = scale(), bc = boardCenter(), reduced = level === 'reduced';
      const T = TIER[card.tier] || TIER.low;
      const w = 210 * k, h = 300 * k;
      const a = fromEl && fromEl.isConnected ? center(fromEl) : { x: bc.x, y: bc.y + 200 * k };
      const tg = targets.filter(e => e && e.isConnected).map(center);
      const end = tg.length ? tg[0] : a;
      const wrap = mk('fx-dice-stage', { left: 0, top: 0, width: '100%', height: '100%', perspective: '1100px' });
      const cardEl = document.createElement('div'); cardEl.className = 'fx-wc';
      Object.assign(cardEl.style, { left: (bc.x - w / 2) + 'px', top: (bc.y - h / 2) + 'px', width: w + 'px', height: h + 'px', fontSize: Math.round(15 * k) + 'px' });
      cardEl.style.setProperty('--tc', T.c);
      cardEl.innerHTML = `<div class="fx-wc-face fx-wc-front" style="background-image:url('/img/wildcards/wc-${card.id}.png')">
          <div class="fx-wc-band"><div class="fx-wc-tier">${T.label}</div><div class="fx-wc-name">${card.name}</div>
          ${card.desc ? `<div class="fx-wc-desc">${card.desc}</div>` : ''}</div></div>
        <div class="fx-wc-face fx-wc-back">🃏</div>`;
      wrap.appendChild(cardEl);
      const fx = a.x - bc.x, fy = a.y - bc.y, ex = end.x - bc.x, ey = end.y - bc.y;
      const D = reduced ? 2400 : 3400;
      const t = (x, y, ry, sc, rz = 0) => `translate(${x}px,${y}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
      done(wrap.animate([{ opacity: 0 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .9 }, { opacity: 0 }], { duration: D, fill: 'both' }), wrap);
      cardEl.animate([
        { transform: t(fx, fy, 180, .15, -20), offset: 0 },
        { transform: t(fx * .3, fy * .3 - 40 * k, 180 + 360, .8, 6), offset: .16 },
        { transform: t(0, 0, 360 + 180, 1.08, 0), offset: .24 },
        { transform: t(0, 0, 720, 1.12, 0), offset: .32 },          // flipped face-up
        { transform: t(0, 0, 720, 1, 0), offset: .38 },
        { transform: t(0, -8 * k, 720, 1, 0), offset: .7 },          // hold so the room can read it
        { transform: t(ex * .7, ey * .7, 720, .45, 8), offset: .86 },
        { transform: t(ex, ey, 720, .12, 14), offset: .9 },
        { transform: t(ex, ey, 720, .05, 14), offset: 1 }
      ], { duration: D, easing: 'cubic-bezier(.3,.6,.35,1)', fill: 'forwards' });
      // reveal burst
      setTimeout(() => {
        ring(bc.x, bc.y, 160 * k, T.c, { dur: 900, grow: 2.4, width: 4 });
        if (!reduced) sparks(bc.x, bc.y, T.c, card.tier === 'high' ? 30 : 16, 220 * k, { dur: 1000, size: 7 });
        if (card.tier === 'high') { shake(7, 420); ring(bc.x, bc.y, 160 * k, '#ffffff', { dur: 700, grow: 3.5, width: 2, delay: 80 }); }
        try { opts.onReveal && opts.onReveal(); } catch (e) {}
      }, D * .3);
      // impact on every target
      setTimeout(() => {
        tg.forEach((c, i) => setTimeout(() => {
          ring(c.x, c.y, 50 * k, T.c, { dur: 700, grow: 3.4, width: 4 });
          if (!reduced) sparks(c.x, c.y, T.c, 12, 80 * k, { dur: 700, size: 6 });
        }, i * 120));
        targets.forEach(el => { if (el && el.isConnected) glow(el, T.c, 900); });
        try { opts.onImpact && opts.onImpact(); } catch (e) {}
        resolve();
      }, D * .89);
    });
  }
  // Plague: sickly pulse rising off each tile
  function plague(tileInner) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale();
    glow(tileInner, '#8bc34a', 1100);
    ring(c.x, c.y, 50 * k, '#6b8e23', { dur: 900, grow: 2.6, width: 4 });
    if (level !== 'reduced') for (let i = 0; i < 7; i++) {
      const s = (6 + Math.random() * 6) * k, x = c.x + (Math.random() * 2 - 1) * 24 * k;
      const d = mk('fx-spark', { width: s + 'px', height: s + 'px', left: x + 'px', top: c.y + 'px', background: '#9ccc65', boxShadow: '0 0 10px #6b8e23', opacity: 0 });
      done(d.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: .9, offset: .2 }, { transform: `translateY(${-60 * k}px) scale(1.6)`, opacity: 0 }],
        { duration: 1100, delay: i * 70, easing: 'ease-out', fill: 'both' }), d);
    }
    banner(c.x, c.y - 60 * k, '−20 HP', '#9ccc65', { size: 15, dur: 1300 });
  }
  // Shatter: the summon on the tile bursts into shards
  function shatterTile(tileInner) {
    if (!tileInner || !tileInner.isConnected) return;
    const c = center(tileInner), k = scale();
    ring(c.x, c.y, 60 * k, '#ffffff', { dur: 600, grow: 3, width: 6 });
    for (let i = 0; i < (level === 'reduced' ? 6 : 18); i++) {
      const a = Math.random() * Math.PI * 2, r = (70 + Math.random() * 110) * k, w = (6 + Math.random() * 12) * k;
      const d = mk('fx-shard', { left: (c.x - w / 2) + 'px', top: (c.y - w / 2) + 'px', width: w + 'px', height: w * 1.4 + 'px',
        background: i % 2 ? '#e8e0ff' : '#ffd77a', boxShadow: '0 0 8px #fff', clipPath: 'polygon(50% 0,100% 40%,70% 100%,0 70%)' });
      done(d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r + 30 * k}px) rotate(${(Math.random() * 2 - 1) * 720}deg)`, opacity: 0 }],
        { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' }), d);
    }
  }

  // ☠ Elimination: board dims, the player's panel cracks apart, a banner names them.
  function eliminated(chipEl, { name = '', color = '#e05252', left = false } = {}) {
    const k = scale(), bc = boardCenter();
    const dim = mk('fx-dim', { background: 'rgba(5,4,14,.6)', opacity: 0 });
    done(dim.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 2600, fill: 'both' }), dim);
    if (chipEl && chipEl.isConnected) {
      const c = center(chipEl);
      for (let i = 0; i < (level === 'reduced' ? 6 : 16); i++) {
        const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 80) * k, w = (6 + Math.random() * 10) * k;
        const d = mk('fx-shard', { left: (c.x + (Math.random() * 2 - 1) * c.w * .4) + 'px', top: c.y + 'px', width: w + 'px', height: w + 'px',
          background: i % 3 ? '#8a8a99' : color, clipPath: 'polygon(50% 0,100% 40%,70% 100%,0 70%)' });
        done(d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * r}px,${Math.abs(Math.sin(a)) * r + 50 * k}px) rotate(${(Math.random() * 2 - 1) * 540}deg)`, opacity: 0 }],
          { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.3,.3,.6,1)', fill: 'both' }), d);
      }
      try { chipEl.animate([{ filter: 'none', transform: 'scale(1)' }, { filter: 'brightness(2)', transform: 'scale(1.05)', offset: .1 }, { filter: 'grayscale(1) brightness(.6)', transform: 'scale(.97)' }], { duration: 900 }); } catch (e) {}
    }
    banner(bc.x, bc.y, left ? `🏳 ${name} HAS LEFT` : `☠ ${name} HAS FALLEN`, left ? '#b2b6ca' : '#e05252', { size: 34, dur: 2500, rise: 20 });
    if (!left) shake(6, 400);
  }

  // 👑 New leader: a crown drops onto the leader's panel.
  function crown(chipEl, { name = '', color = '#ffd77a' } = {}) {
    if (!chipEl || !chipEl.isConnected) return;
    const c = center(chipEl), k = scale();
    const x = c.x - c.w / 2 + 22 * k, y = c.y - c.h / 2 + 2 * k;
    const d = mk('fx-crown', { left: x + 'px', top: y + 'px', fontSize: Math.round(30 * k) + 'px', opacity: 0 });
    d.textContent = '👑';
    done(d.animate([
      { transform: `translate(-50%,calc(-50% - ${90 * k}px)) rotate(-25deg) scale(1.6)`, opacity: 0 },
      { transform: 'translate(-50%,-50%) rotate(8deg) scale(1.1)', opacity: 1, offset: .35 },
      { transform: `translate(-50%,calc(-50% - ${8 * k}px)) rotate(-4deg) scale(1)`, opacity: 1, offset: .5 },
      { transform: 'translate(-50%,-50%) rotate(0) scale(1)', opacity: 1, offset: .62 },
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }
    ], { duration: 1800, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }), d);
    setTimeout(() => { ring(x, y, 24 * k, '#ffd77a', { dur: 600, grow: 3, width: 3 }); if (level !== 'reduced') sparks(x, y, '#ffd77a', 12, 50 * k, { dur: 700, size: 5 }); }, 600);
    // label sits on the board just left of the leader's own panel
    banner(c.x - c.w / 2 - 110 * k, c.y, name ? `👑 NEW LEADER · ${name}` : '👑 NEW LEADER', color, { size: 14, dur: 2200, rise: 14 });
  }

  window.BoardFX = {
    rollDice, claim, hop, ripple,
    challenge, takeover, held, clash, manaRoll, manaFloat, flow, chest, temple, heal, well,
    wildCard, plague, shatterTile, eliminated, crown,
    get level() { return level; },
    setLevel(v) { level = v === 'reduced' ? 'reduced' : 'full'; try { localStorage.setItem(LS_KEY, level); } catch (e) {} },
  };
})();

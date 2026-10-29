/* ─────────────────────────────────────────────────────────────────────────────
 * Summoner's Gambit — board-fx.js  (v0.6.35, Tier 1–3 board interaction effects)
 *  v0.6.35: sxMoment — tarot Sanctioned / Redeemed moments (card flips to Sanctioned, turns over to Life)
 *  v0.6.34: Sanction table SFX hooks (opts.sfx: fanfare / blessing / curse / jackpot / fly)
 *  v0.6.33: Omen reveals on the Sanction card table
 *  v0.6.32: Sacrifice reveal holds the summon on its tile until the card lands (sxTileHold)
 *  v0.6.31: BoardFX.sxTable() — Sanction turn card table (deal → carousel → card back → reveal), spec in SANCTION_REVEAL_SPEC.md
 *  v0.6.30: ring + sparks exported (Wheel of Fortune flip on the board)
 *  v0.6.26: BoardFX.wcTable() — face-down Wild Card table dealt on doubles (grey → live → flip / pass)
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
  .sxt-stage{position:absolute;inset:0;perspective:1500px;}
  .sxt-vign{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at var(--vx) var(--vy), transparent 18%, rgba(0,0,0,.72) 68%);}
  .sxt-card{position:absolute;left:0;top:0;will-change:transform;}
  .sxt-in{position:relative;width:100%;height:100%;transform-style:preserve-3d;}
  .sxt-face{position:absolute;inset:0;border-radius:10px;overflow:hidden;backface-visibility:hidden;background:#151627 center/cover no-repeat;box-shadow:0 8px 22px rgba(0,0,0,.65);}
  .sxt-face img{width:100%;height:100%;object-fit:cover;display:block;}
  .sxt-fb{transform:rotateY(180deg);}
  .sxt-glow{position:absolute;inset:-2px;border-radius:12px;opacity:0;transition:opacity .3s;box-shadow:0 0 0 2px var(--gc,#ffd77a),0 0 34px var(--gc,#ffd77a);}
  .sxt-card.glow .sxt-glow{opacity:1;}
  .sxt-sm{position:absolute;inset:0;border:2px solid var(--ec,#c9a05a);border-radius:10px;display:flex;flex-direction:column;justify-content:flex-end;}
  .sxt-band{background:linear-gradient(180deg,transparent,rgba(9,9,22,.95) 40%);padding:1.6em .5em .5em;text-align:center;}
  .sxt-name{font-family:'Cinzel',serif;font-weight:700;font-size:1.05em;color:var(--ec,#e8c26e);}
  .sxt-own{font-size:.8em;font-weight:600;margin-top:.15em;font-family:Inter,sans-serif;}
  .sxt-lbl{position:absolute;left:50%;top:-1.9em;transform:translateX(-50%);font-family:'Cinzel',serif;font-weight:700;font-size:1em;padding:.2em .6em;border-radius:5px;background:#2a1418;border:1px solid #a8434a;color:#ff8a80;white-space:nowrap;}
  .sxt-lbl.own{background:#3a2a10;border-color:#c9a05a;color:#ffcc80;}
  .sxt-rays{position:absolute;border-radius:50%;opacity:0;background:repeating-conic-gradient(from 0deg, var(--rc) 0deg 6deg, transparent 6deg 18deg);-webkit-mask:radial-gradient(circle,#000 0 28%,transparent 70%);mask:radial-gradient(circle,#000 0 28%,transparent 70%);}
  .sxt-status,.sxt-cap{position:absolute;transform:translate(-50%,0);text-align:center;font-family:'Cinzel',serif;font-weight:900;letter-spacing:.14em;white-space:nowrap;text-shadow:0 2px 6px #000;}
  .sxt-status{color:#ecebf2;}
  .sxt-status em{font-style:normal;}
  .sxt-status small,.sxt-cap small{display:block;font-family:Inter,sans-serif;font-weight:500;letter-spacing:.02em;color:#a3a6bb;margin-top:.45em;font-size:.8em;}
  .sxt-cap{opacity:0;}
  .sxt-cap small{color:#ecebf2;letter-spacing:.14em;font-family:'Cinzel',serif;font-weight:700;font-size:.5em;}
  .sxt-flash{position:absolute;border-radius:50%;}
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
  /* v0.6.26: Wild Card table */
  .wct-stage{position:absolute;left:0;top:0;width:100%;height:100%;transition:opacity .45s ease;}
  .wct-slot{position:absolute;will-change:transform,opacity;}
  .wct-breath{position:absolute;inset:0;perspective:1100px;}
  .wct-slot .fx-wc{position:absolute;inset:0;}
  .wct-slot .fx-wc-face{transition:filter .9s ease,box-shadow .9s ease;}
  .wct-slot .fx-wc-back{background:#120c26 center/cover no-repeat;font-size:0;box-shadow:0 0 18px var(--tc);}
  .wct-grey .fx-wc-face{filter:grayscale(1) brightness(.5);box-shadow:none;}
  .wct-live .wct-breath{animation:wct-breathe 2.4s ease-in-out infinite;animation-delay:var(--bd,0s);}
  .wct-live .fx-wc-back{animation:wct-glow 2.4s ease-in-out infinite;animation-delay:var(--bd,0s);}
  .wct-live.wct-high .fx-wc-back{animation-name:wct-glow-hi;}
  @keyframes wct-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
  @keyframes wct-glow{0%,100%{box-shadow:0 0 14px var(--tc)}50%{box-shadow:0 0 34px var(--tc)}}
  @keyframes wct-glow-hi{0%,100%{box-shadow:0 0 20px var(--tc)}50%{box-shadow:0 0 56px var(--tc),0 0 90px rgba(255,215,122,.35)}}
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
      const ft = !!opts.fromTable;   // v0.6.26: card is already face-up in the centre (Wild Card table)
      const D = ft ? (reduced ? 2000 : 2800) : (reduced ? 2400 : 3400);
      const t = (x, y, ry, sc, rz = 0) => `translate(${x}px,${y}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
      done(wrap.animate(ft ? [{ opacity: 1 }, { opacity: 1, offset: .88 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .9 }, { opacity: 0 }], { duration: D, fill: 'both' }), wrap);
      cardEl.animate(ft ? [
        { transform: t(0, 0, 720, TABLE_W / 210), offset: 0 },
        { transform: t(0, 0, 720, 1.08), offset: .08 },
        { transform: t(0, 0, 720, 1), offset: .14 },
        { transform: t(0, -8 * k, 720, 1), offset: .55 },          // hold so the room can read it
        { transform: t(ex * .7, ey * .7, 720, .45, 8), offset: .8 },
        { transform: t(ex, ey, 720, .12, 14), offset: .86 },
        { transform: t(ex, ey, 720, .05, 14), offset: 1 }
      ] : [
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
      }, D * (ft ? .06 : .3));
      // impact on every target
      setTimeout(() => {
        tg.forEach((c, i) => setTimeout(() => {
          ring(c.x, c.y, 50 * k, T.c, { dur: 700, grow: 3.4, width: 4 });
          if (!reduced) sparks(c.x, c.y, T.c, 12, 80 * k, { dur: 700, size: 6 });
        }, i * 120));
        targets.forEach(el => { if (el && el.isConnected) glow(el, T.c, 900); });
        try { opts.onImpact && opts.onImpact(); } catch (e) {}
        resolve();
      }, D * (ft ? .85 : .89));
    });
  }
  // ═══════════════ v0.6.26: Wild Card table (doubles) ═══════════════
  // Three face-down tier cards dealt into the board centre when a player rolls doubles.
  // grey (turn in progress) → live (choosing: colour + breathing) → picked (chosen card flips
  // face-up, the others sink away unrevealed) → consumed by wildCard({fromTable}) — or passed.
  // State-driven: board.html calls wcTable(G.wcTable, phase, …) on every render.
  // v0.6.28: WC_TABLE_SCALE sizes the three table cards (1 = original 150×214 px; 0.80 → 120×171 px). Text scales with it.
  // WC_TABLE_GAP = space between the cards in board px (was 34 × scale; v0.6.29: 10).
  const WC_TABLE_SCALE = 0.80;
  const WC_TABLE_GAP = 10;
  const TABLE_W = 150 * WC_TABLE_SCALE, TABLE_H = 214 * WC_TABLE_SCALE, TABLE_GAP = WC_TABLE_GAP;
  const TIERS = ['low', 'mid', 'high'];
  const HIDE_PHASES = new Set(['resolve:battle', 'resolve:battle_result', 'stalemate', 'resolve:chest', 'resolve:temple',
    'resolve:round_callout', 'resolve:turn_summary', 'game_over']);
  const WCT = { seq: 0, stage: null, slots: {}, state: '', consumed: false, pickedAt: 0, pickTier: null };
  // preload the three tier backs so the first deal never shows empty frames
  try { TIERS.forEach(t => { const im = new Image(); im.src = `/img/wildcards/wc-mask-${t}.png`; }); } catch (e) {}
  function _wctPos(tier) {
    const k = scale(), bc = boardCenter(), i = TIERS.indexOf(tier);
    const w = TABLE_W * k, h = TABLE_H * k, gap = TABLE_GAP * k;
    return { x: bc.x + (i - 1) * (w + gap) - w / 2, y: bc.y - h / 2, w, h, k, bc };
  }
  function _wctLayout() {
    TIERS.forEach(tier => {
      const s = WCT.slots[tier]; if (!s) return;
      const p = _wctPos(tier);
      Object.assign(s.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px', fontSize: Math.round(11 * WC_TABLE_SCALE * p.k) + 'px' });
    });
  }
  function _wctClear(fade) {
    const st = WCT.stage;
    WCT.stage = null; WCT.slots = {}; WCT.state = ''; WCT.pickTier = null;
    if (!st) return;
    if (fade) { st.style.opacity = '0'; setTimeout(() => st.remove(), 500); } else st.remove();
  }
  function _wctBuild(t, animate, sfx) {
    _wctClear(false);
    const stage = mk('wct-stage', {}); stage.classList.remove('fx-abs');
    WCT.stage = stage; WCT.seq = t.seq; WCT.consumed = false; WCT.state = '';
    const reduced = level === 'reduced';
    TIERS.forEach((tier, i) => {
      const T = TIER[tier];
      const slot = document.createElement('div'); slot.className = 'wct-slot wct-grey wct-' + tier;
      slot.style.setProperty('--tc', T.c); slot.style.setProperty('--bd', (i * .35) + 's');
      slot.innerHTML = `<div class="wct-breath"><div class="fx-wc" style="transform:rotateY(180deg)">
          <div class="fx-wc-face fx-wc-front"></div>
          <div class="fx-wc-face fx-wc-back" style="background-image:url('/img/wildcards/wc-mask-${tier}.png')"></div></div></div>`;
      stage.appendChild(slot); WCT.slots[tier] = slot;
    });
    _wctLayout();
    if (!animate) return;
    TIERS.forEach((tier, i) => {
      const slot = WCT.slots[tier], p = _wctPos(tier), k = p.k, delay = i * 230;
      if (reduced) { slot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay, fill: 'backwards' }); return; }
      slot.animate([
        { transform: `translate(${-(i - 1) * 120 * k}px,${-380 * k}px) rotate(${(i - 1) * -24 - 10}deg) scale(1.25)`, opacity: 0 },
        { opacity: 1, offset: .25 },
        { transform: `translate(0,${10 * k}px) rotate(${(i - 1) * 2}deg) scale(.98)`, offset: .78 },
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }
      ], { duration: 520, delay, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'backwards' });
      setTimeout(() => {
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        try { sfx.deal && sfx.deal(i); } catch (e) {}
        ring(cx, cy + p.h * .4, 70 * k, TIER[tier].c, { dur: 500, grow: 1.8, width: 3 });
        if (tier === 'high') { shake(5, 300); sparks(cx, cy, TIER.high.c, 14, 120 * k, { dur: 800, size: 5 }); }
      }, delay + 400);
    });
  }
  function _wctSetState(state, t, sfx) {
    if (state === WCT.state) return;
    const prev = WCT.state; WCT.state = state;
    const reduced = level === 'reduced';
    TIERS.forEach(tier => {
      const s = WCT.slots[tier]; if (!s) return;
      s.classList.toggle('wct-grey', state === 'grey');
      s.classList.toggle('wct-live', state === 'live');
    });
    if (state === 'live' && prev && !reduced) {
      const bc = boardCenter(); ring(bc.x, bc.y, 220 * scale(), '#ffd77a', { dur: 900, grow: 2, width: 3 });
      try { sfx.live && sfx.live(); } catch (e) {}
    }
    if (state === 'picked' && t.pick) {
      const tier = t.pick.tier, slot = WCT.slots[tier]; if (!slot) return;
      WCT.pickTier = tier; WCT.pickedAt = Date.now();
      const T = TIER[tier];
      slot.querySelector('.fx-wc-front').style.backgroundImage = `url('/img/wildcards/wc-${t.pick.id}.png')`;
      slot.querySelector('.fx-wc-front').innerHTML = `<div class="fx-wc-band"><div class="fx-wc-tier">${T.label}</div><div class="fx-wc-name">${t.pick.name}</div>
          ${t.pick.desc ? `<div class="fx-wc-desc">${t.pick.desc}</div>` : ''}</div>`;
      const p = _wctPos(tier), k = p.k, dx = p.bc.x - (p.x + p.w / 2);
      const card = slot.querySelector('.fx-wc');
      // the unchosen two sink away, still face-down
      TIERS.filter(x => x !== tier).forEach(x => {
        const o = WCT.slots[x];
        o.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${70 * k}px) scale(.9)`, opacity: 0 }],
          { duration: 500, easing: 'ease-in', fill: 'forwards' });
      });
      slot.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,0)` }], { duration: 450, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
      if (reduced) { card.style.transform = 'rotateY(360deg)'; slot.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 350 }); }
      else card.animate([{ transform: 'rotateY(180deg) scale(1)' }, { transform: 'rotateY(270deg) scale(1.15)', offset: .5 }, { transform: 'rotateY(360deg) scale(1)' }],
        { duration: 700, delay: 250, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
      setTimeout(() => {
        const cx = p.bc.x, cy = p.bc.y;
        ring(cx, cy, 120 * k, T.c, { dur: 800, grow: 2.2, width: 4 });
        if (!reduced) sparks(cx, cy, T.c, tier === 'high' ? 24 : 12, 160 * k, { dur: 900, size: 6 });
        if (tier === 'high') shake(5, 320);
        try { sfx.reveal && sfx.reveal(tier); } catch (e) {}
      }, reduced ? 100 : 600);
    }
    if (state === 'skipped') {
      WCT.consumed = true;
      const bc = boardCenter(), k = scale();
      TIERS.forEach((tier, i) => {
        const s = WCT.slots[tier]; if (!s) return;
        s.classList.remove('wct-live');
        s.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
          { transform: `translate(${(i - 1) * 60 * k}px,${420 * k}px) rotate(${(i - 1) * 14}deg)`, opacity: 0 }],
          { duration: reduced ? 400 : 650, delay: i * 70, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
      });
      banner(bc.x, bc.y, 'PASSED', '#9397ab', { size: 22, dur: 1400, rise: 20 });
      try { sfx.skip && sfx.skip(); } catch (e) {}
      const st = WCT.stage; setTimeout(() => { if (WCT.stage === st) _wctClear(false); else if (st) st.remove(); }, 1000);
    }
  }
  // t = G.wcTable (or null). opts: { instant, deal, sfx }
  //   instant → (re)build silently in the right state (first state after a reload)
  //   deal    → new table: deal it in (called from the board's FX queue once the dice settle)
  function wcTable(t, phase, opts = {}) {
    const sfx = opts.sfx || {};
    if (!t) { if (WCT.stage) _wctClear(true); WCT.seq = 0; return; }
    if (t.seq !== WCT.seq) {
      if (!opts.deal && !opts.instant) return;            // wait for the queued deal
      if (opts.instant && (t.skipped)) { WCT.seq = t.seq; WCT.consumed = true; return; }
      _wctBuild(t, !!opts.deal, sfx);
      if (opts.instant && t.pick) {                        // reload mid-targeting: show the picked card, no anim
        WCT.state = 'picked'; WCT.pickTier = t.pick.tier; WCT.pickedAt = 0;
        const slot = WCT.slots[t.pick.tier], T = TIER[t.pick.tier];
        TIERS.filter(x => x !== t.pick.tier).forEach(x => WCT.slots[x].style.opacity = '0');
        const p = _wctPos(t.pick.tier); slot.style.transform = `translate(${p.bc.x - (p.x + p.w / 2)}px,0)`;
        slot.classList.remove('wct-grey');
        const fr = slot.querySelector('.fx-wc-front');
        fr.style.backgroundImage = `url('/img/wildcards/wc-${t.pick.id}.png')`;
        fr.innerHTML = `<div class="fx-wc-band"><div class="fx-wc-tier">${T.label}</div><div class="fx-wc-name">${t.pick.name}</div></div>`;
        slot.querySelector('.fx-wc').style.transform = 'rotateY(360deg)';
      }
    }
    if (WCT.consumed || !WCT.stage) return;
    WCT.stage.style.opacity = HIDE_PHASES.has(phase) ? '0' : '1';   // battles etc. cover the cards
    if (!WCT.state || WCT.state === 'grey' || WCT.state === 'live') _wctLayout();
    const want = t.skipped ? 'skipped' : t.pick ? 'picked' : phase === 'resolve:wildcard_cards' ? 'live' : 'grey';
    _wctSetState(want, t, sfx);
  }
  // The picked card is about to fly to its target: wait for its flip to finish, then hand over.
  // Resolves true if the table owned this card (so wildCard() should start from the centre).
  function wcTableConsume(card) {
    return new Promise(resolve => {
      if (!WCT.stage || WCT.consumed || WCT.pickTier !== card.tier) { resolve(false); return; }
      WCT.consumed = true;
      const wait = Math.max(0, (level === 'reduced' ? 700 : 1500) - (Date.now() - WCT.pickedAt));
      setTimeout(() => { _wctClear(false); resolve(true); }, wait);
    });
  }

  // ═══════════════ v0.6.31: Sanction card table ═══════════════
  // State-driven from board.html: sxTable(G, { tileEl(pos), onRevealDone(seq), myColor }) on every render.
  // pick_tile: one summon card lands, fans out to the three offers; the carousel follows sanction.previewPos.
  // own / omen: the other two slide behind, neutral fanfare, flip to the Wheel / Omen card back, breathe.
  // reveal: neutral fanfare, flip to the result art (colour only after it's face-up), caption, fly to the tile.
  const SXT = { seq: 0, stage: null, cards: [], offers: [], idx: 1, state: '', revealSeq: 0, q: Promise.resolve(), breath: null, busy: false, hold: null, tileHold: null, lastBoard: null };
  const SXT_NEUTRAL = '#d8d2ff';
  const sxT = () => (typeof SX_TIMING !== 'undefined' ? SX_TIMING : { speed: 1.5, cardW: 100, revealScale: 1.5, spread: 120, land: 520, fan: 620, turn: 420, gather: 480, fanfare: 1100, flip: 820, result: 1400, settle: 650 });
  const sxD = b => (level === 'reduced' ? .55 : 1) * (sxT()[b] || 0) / sxT().speed;
  function _sxtGeo() {
    const k = scale(), bc = boardCenter(), w = sxT().cardW * k, h = w * 532 / 300;
    return { k, cx: bc.x, cy: bc.y - 10 * k, w, h };
  }
  function _sxtAt(x, y, sc = 1, rot = 0, ry = 0) { const g = _sxtGeo(); return `translate(${x - g.w / 2}px,${y - g.h / 2}px) rotate(${rot}deg) rotateY(${ry}deg) scale(${sc})`; }
  function _sxtAnim(el, frames, ms, opt = {}) { return el.animate(frames, { duration: Math.max(1, ms), easing: opt.ease || 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards', delay: opt.delay || 0 }).finished.catch(() => {}); }
  function _sxtClear(fade) {
    const st = SXT.stage; SXT.stage = null; SXT.cards = []; SXT.state = ''; SXT.busy = false; SXT.hold = null; SXT.tileHold = null;
    if (SXT.breath) { try { SXT.breath.cancel(); } catch (e) {} SXT.breath = null; }
    if (!st) return;
    if (fade) { st.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).finished.then(() => st.remove(), () => st.remove()); } else st.remove();
  }
  function _sxtSlot(j) { let d = (j - SXT.idx + 3) % 3; return d === 2 ? -1 : d; }
  function _sxtSlotT(s) { const g = _sxtGeo(), sp = sxT().spread * g.k; return s === 0 ? _sxtAt(g.cx, g.cy, 1.28) : _sxtAt(g.cx + s * sp, g.cy + 14 * g.k, .86, s * 4, s * -22); }
  function _sxtStatus(html) { if (!SXT.stage) return; const el = SXT.stage.querySelector('.sxt-status'); if (el) el.innerHTML = html || ''; }
  function _sxtVign(on) { const v = SXT.stage && SXT.stage.querySelector('.sxt-vign'); if (v) _sxtAnim(v, [{ opacity: getComputedStyle(v).opacity }, { opacity: on ? 1 : 0 }], 400); }
  function _sxtBuild(G, opts) {
    _sxtClear(false);
    const g = _sxtGeo(), sx = G.sanction;
    const stage = mk('sxt-stage', {}); stage.classList.remove('fx-abs'); SXT.stage = stage;
    stage.innerHTML = `<div class="sxt-vign" style="--vx:${g.cx}px;--vy:${g.cy}px"></div><div class="sxt-status" style="left:${g.cx}px;top:${g.cy + 172 * g.k}px;font-size:${Math.round(15 * g.k)}px"></div>`;
    SXT.seq = sx.seq; SXT.offers = sx.offers.slice(); SXT.idx = Math.min(1, SXT.offers.length - 1); SXT.state = 'built'; SXT.revealSeq = sx.revealSeq || 0;
    const cur = G.players.find(p => p.idx === sx.playerIdx);
    SXT.cards = SXT.offers.map(pos => {
      const t = G.board[pos], m = t.summon || {}, ow = G.players.find(p => p.idx === t.ownerId), own = t.ownerId === sx.playerIdx;
      const ec = (typeof TYPE_COLOR !== 'undefined' && TYPE_COLOR[m.type]) || '#c9a05a';
      const src = m.id && typeof monsterAnimSrc === 'function' ? monsterAnimSrc(m.id) : '';
      const fallback = m.id && typeof monsterCardSrc === 'function' ? monsterCardSrc(m.id) : '';
      const c = document.createElement('div'); c.className = 'sxt-card';
      Object.assign(c.style, { width: g.w + 'px', height: g.h + 'px', fontSize: Math.round(12 * g.k) + 'px' });
      c.innerHTML = `<div class="sxt-lbl${own ? ' own' : ''}">Tile ${pos}</div><div class="sxt-in">
          <div class="sxt-face sxt-fa">${src ? `<img src="${src}" alt="" onerror="this.onerror=null;this.src='${fallback}'">` : ''}<div class="sxt-sm" style="--ec:${ec}"><div class="sxt-band"><div class="sxt-name">${m.name || ''}</div><div class="sxt-own" style="color:${own ? '#5dc97d' : (ow ? ow.color : '#a3a6bb')}">${own ? 'Their own tile' : (ow ? ow.name : '')}</div></div></div></div>
          <div class="sxt-face sxt-fb"></div></div><div class="sxt-glow"></div>`;
      c._ry = 0; c._pos = pos; c._own = own;
      stage.appendChild(c); return c;
    });
    _sxtStatus(`<em style="color:${cur ? cur.color : '#e05252'}">${cur ? cur.name.toUpperCase() : ''}'S</em> SANCTION TURN<small>Choosing one of three tiles</small>`);
    SXT.curName = cur ? cur.name : '';
    SXT.curColor = cur ? cur.color : '#e05252';
  }
  function _sxtPlace(animate) {
    const g = _sxtGeo();
    return Promise.all(SXT.cards.map((c, j) => {
      const s = _sxtSlot(j), to = _sxtSlotT(s), from = c._t || to;
      c.style.zIndex = s === 0 ? 30 : 10;
      c.classList.toggle('glow', s === 0); c.style.setProperty('--gc', '#ffd77a');
      c.style.filter = s === 0 ? '' : 'brightness(.6) saturate(.7)';
      c.querySelector('.sxt-lbl').style.opacity = s === 0 ? 1 : .55;
      const wrap = c._s !== undefined && Math.abs(c._s - s) === 2; c._s = s; c._t = to;
      if (!animate) { c.getAnimations().forEach(a => a.cancel()); c.style.transform = to; return Promise.resolve(); }
      return _sxtAnim(c, wrap ? [{ transform: from, opacity: 1 }, { transform: _sxtAt(g.cx, g.cy - 30 * g.k, .6), opacity: .35, offset: .5 }, { transform: to, opacity: 1 }] : [{ transform: from }, { transform: to }], sxD('turn'), { ease: 'cubic-bezier(.35,.7,.3,1)' });
    }));
  }
  async function _sxtDeal() {
    const g = _sxtGeo(); SXT.busy = true;
    SXT.cards.forEach((c, j) => { c.style.zIndex = j === SXT.idx ? 30 : 10 + j; c.querySelector('.sxt-lbl').style.opacity = 0; });
    if (level === 'reduced') { _sxtPlace(false); await Promise.all(SXT.cards.map(c => _sxtAnim(c, [{ opacity: 0 }, { opacity: 1 }], 350))); SXT.busy = false; return; }
    await Promise.all(SXT.cards.map(c => _sxtAnim(c, [{ transform: _sxtAt(g.cx + 60 * g.k, g.cy - 560 * g.k, 1.1, -16), opacity: 0 }, { opacity: 1, offset: .3 }, { transform: _sxtAt(g.cx, g.cy + 8 * g.k, 1, 1), offset: .82 }, { transform: _sxtAt(g.cx, g.cy) }], sxD('land'))));
    ring(g.cx, g.cy + g.h / 2, 70 * g.k, '#c9a05a', { dur: 500, grow: 2, width: 3 });
    await Promise.all(SXT.cards.map((c, j) => {
      const s = _sxtSlot(j), to = _sxtSlotT(s); c._t = to; c._s = s;
      _sxtAnim(c.querySelector('.sxt-lbl'), [{ opacity: 0 }, { opacity: s === 0 ? 1 : .55 }], sxD('fan'));
      return _sxtAnim(c, [{ transform: _sxtAt(g.cx, g.cy) }, { transform: _sxtAt(g.cx + s * sxT().spread * g.k * .5, g.cy - 20 * g.k, 1.05, s * 10), offset: .45 }, { transform: to }], sxD('fan'), { ease: 'cubic-bezier(.3,.8,.3,1)' });
    }));
    _sxtPlace(false); SXT.busy = false;
  }
  // fanfare (neutral) → flip to img → colour lands. Returns once the card is face-up.
  async function _sxtFlip(c, img, color, o = {}) {
    const g = _sxtGeo(), x = g.cx, y = g.cy - 10 * g.k, base = o.base || 1.28, big = o.big || base, reduced = level === 'reduced';
    _sxtVign(true);
    let rays = null;
    if (o.sfx && sxD('fanfare') > 0) o.sfx('fanfare');
    if (!reduced && sxD('fanfare') > 0) {
      rays = document.createElement('div'); rays.className = 'sxt-rays'; rays.style.setProperty('--rc', SXT_NEUTRAL + '55');
      const R = 300 * g.k; Object.assign(rays.style, { left: x - R + 'px', top: y - R + 'px', width: R * 2 + 'px', height: R * 2 + 'px' });
      SXT.stage.insertBefore(rays, SXT.stage.querySelector('.sxt-card'));
      rays.animate([{ transform: 'rotate(0)', opacity: 0 }, { opacity: 1, offset: .3 }, { transform: 'rotate(60deg)', opacity: 1 }], { duration: sxD('fanfare') + sxD('flip'), fill: 'forwards' });
      c.classList.add('glow'); c.style.setProperty('--gc', SXT_NEUTRAL);
      const n = 10;
      await _sxtAnim(c, [...Array(n + 1)].map((_, i) => ({ transform: _sxtAt(x + (i % 2 ? 1.8 : -1.8) * (i / n) * g.k, y - 18 * g.k * (i / n), base + (big - base) * .4 * (i / n), (i % 2 ? .9 : -.9) * (i / n)) })), sxD('fanfare'), { ease: 'linear' });
    } else if (sxD('fanfare') > 0) await new Promise(r => setTimeout(r, sxD('fanfare') * .5));
    const inner = c.querySelector('.sxt-in'), cur = c._ry, next = cur + 180, odd = (next / 180) % 2 === 1;
    const face = odd ? c.querySelector('.sxt-fb') : c.querySelector('.sxt-fa');
    face.innerHTML = ''; face.style.backgroundImage = `url('${img}')`;
    face.style.transform = (odd ? 'rotateY(180deg)' : 'rotateY(0deg)') + (o.upsideDown ? ' rotateZ(180deg)' : '');
    c._ry = next;
    const fromS = base + (big - base) * .4;
    await Promise.all([
      _sxtAnim(c, [{ transform: _sxtAt(x, y - 18 * g.k, fromS) }, { transform: _sxtAt(x, y - 40 * g.k, big + .15), offset: .5 }, { transform: _sxtAt(x, y - 24 * g.k, big) }], sxD('flip')),
      reduced ? (inner.style.transform = `rotateY(${next}deg)`, Promise.resolve()) :
        _sxtAnim(inner, [{ transform: `rotateY(${cur}deg)` }, { transform: `rotateY(${cur + 90}deg)`, offset: .5 }, { transform: `rotateY(${next}deg)` }], sxD('flip'), { ease: 'cubic-bezier(.5,0,.3,1)' }),
    ]);
    // face-up: now the colour lands
    if (o.sfx && o.landSfx) o.landSfx.forEach(k => o.sfx(k));
    c.classList.add('glow'); c.style.setProperty('--gc', color);
    if (!reduced) {
      const f = document.createElement('div'); f.className = 'sxt-flash'; const F = 260 * g.k;
      Object.assign(f.style, { left: x - F + 'px', top: y - 24 * g.k - F + 'px', width: F * 2 + 'px', height: F * 2 + 'px', background: `radial-gradient(circle, ${color} 0%, transparent 60%)` });
      SXT.stage.appendChild(f); f.animate([{ opacity: .9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.2)' }], { duration: 650, easing: 'ease-out' }).finished.then(() => f.remove(), () => f.remove());
      ring(x, y - 24 * g.k, 130 * g.k, color, { dur: 900, grow: 2.3, width: 4 });
      sparks(x, y - 24 * g.k, color, o.sparks || 20, 240 * g.k, { dur: 950, size: 6 });
    }
    if (rays) { rays.style.setProperty('--rc', color + '66'); rays.animate([{ opacity: 1, transform: 'rotate(60deg) scale(1)' }, { opacity: 1, transform: 'rotate(75deg) scale(1.08)', offset: .5 }, { opacity: 0, transform: 'rotate(90deg) scale(1.12)' }], { duration: 1300, fill: 'forwards' }).finished.then(() => rays.remove(), () => rays.remove()); }
    c._t = _sxtAt(x, y - 24 * g.k, big);
  }
  async function _sxtChoose(G, pickedPos) {
    const g = _sxtGeo(); SXT.busy = true;
    const ci = SXT.offers.indexOf(pickedPos); if (ci < 0) { SXT.busy = false; return; }
    SXT.idx = ci; await _sxtPlace(true);
    const c = SXT.cards[ci], others = SXT.cards.filter((_, j) => j !== ci);
    SXT.chosen = c;
    others.forEach(o => { o.style.zIndex = 5; o.querySelector('.sxt-lbl').style.opacity = 0; });
    _sxtAnim(c.querySelector('.sxt-lbl'), [{ opacity: 1 }, { opacity: 0 }], 200);
    await Promise.all([
      ...others.map((o, k) => _sxtAnim(o, [{ transform: o._t }, { transform: _sxtAt(g.cx + (k ? 10 : -10) * g.k, g.cy - 4 * g.k, 1.18, k ? 4 : -4), filter: 'brightness(.45)' }], sxD('gather'), { ease: 'cubic-bezier(.4,0,.2,1)' })),
      _sxtAnim(c, [{ transform: c._t }, { transform: _sxtAt(g.cx, g.cy - 10 * g.k, 1.28) }], sxD('gather')),
    ]);
    others.forEach(o => _sxtAnim(o, [{ opacity: 1 }, { opacity: 0 }], 300));
    const own = c._own, t = G.board[pickedPos], ow = G.players.find(p => p.idx === t.ownerId);
    _sxtStatus(`<em style="color:${SXT.curColor}">${SXT.curName.toUpperCase()}</em> CHOSE TILE ${pickedPos}<small>${own ? 'Their own tile' : `${ow ? ow.name + "'s" : 'A rival\'s'} ${t.summon ? t.summon.name : 'tile'}`}</small>`);
    await _sxtFlip(c, own ? '/img/omens/omen-back-wheel.webp' : '/img/omens/omen-back-omen.webp', own ? '#ffd77a' : '#b5abfc', { base: 1.28, big: 1.36, sparks: 12, sfx: SXT.sfx });
    _sxtVign(false);
    _sxtStatus(`<em style="color:${SXT.curColor}">${SXT.curName.toUpperCase()}</em> IS DECIDING<small>${own ? 'Sacrifice, Redeem or turn the Wheel' : `Placing an Omen on ${ow ? ow.name + "'s" : 'a rival\'s'} tile`}</small>`);
    const rest = _sxtAt(g.cx, g.cy - 34 * g.k, 1.36);
    if (level !== 'reduced') SXT.breath = c.animate([{ transform: rest }, { transform: _sxtAt(g.cx, g.cy - 40 * g.k, 1.39) }, { transform: rest }], { duration: 2600, iterations: Infinity, easing: 'ease-in-out' });
    c._t = rest; SXT.state = 'chosen'; SXT.busy = false;
  }
  const FORT = { 1: 'Glimmer', 2: 'Radiance', 3: 'Exaltation', '-1': 'Tarnish', '-2': 'Blight', '-3': 'Doom' };
  async function _sxtReveal(G, opts) {
    const sx = G.sanction, r = sx.result || {}, g = _sxtGeo(), c = SXT.chosen; SXT.busy = true;
    if (!c) { SXT.busy = false; return; }
    if (SXT.breath) { SXT.breath.cancel(); SXT.breath = null; c.style.transform = c._t; }
    const sign = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';
    let R;
    if (r.kind === 'sacrifice') R = { img: '/img/omens/omen-sacrifice.webp', col: '#ff6b6b', title: 'SACRIFICE', sub: `${r.summonName || 'Summon'} destroyed · +${r.gain}✦ · Tile ${r.pos} goes neutral` };
    else if (r.kind === 'redeem') R = { img: '/img/omens/omen-redeem.webp', col: '#ffd77a', title: 'REDEEMED', sub: `${SXT.curName} is back in the game` };
    else if (r.kind === 'wheel') R = r.jackpot
      ? { img: '/img/omens/omen-wheel-of-fortune.webp', col: r.upright ? '#ffd77a' : '#ff6b6b', title: `JACKPOT +${r.jackpot}✦`, sub: `Tile ${r.pos} stays at ${FORT[r.after]} ${sign(r.after)}`, upsideDown: !r.upright, jack: true }
      : { img: '/img/omens/omen-wheel-of-fortune.webp', col: r.upright ? '#ffd77a' : '#ff6b6b', title: r.upright ? 'BLESSING' : 'CURSE', sub: `Tile ${r.pos} · ${r.after ? FORT[r.after] + ' ' + sign(r.after) : 'Neutral 0'}`, upsideDown: !r.upright };
    else if (r.kind === 'omen') { const b = r.omenKind === 'blessing', ow = G.players.find(p => p.idx === r.ownerIdx);
      R = { img: `/img/omens/omen-${r.id}.webp`, col: b ? '#ffd77a' : '#ff6b6b', title: (r.name || 'OMEN').toUpperCase(), sub: `${b ? 'Blessing' : 'Curse'} on ${ow ? ow.name + "'s" : 'the'} tile ${r.pos}`, pin: true }; }
    else R = { img: '/img/omens/omen-back-omen.webp', col: '#b5abfc', title: 'OMEN', sub: '' };
    // hold the tile's Fortune number at its old value until the card lands
    SXT.hold = r.kind === 'wheel' ? { pos: r.pos, val: r.before } : r.kind === 'omen' ? { pos: r.pos, omen: r.replaced ? { id: r.replaced } : null, omenHold: true } : null;
    // Sacrifice: keep drawing the summon on its tile (from the board as it was before the action)
    SXT.tileHold = r.kind === 'sacrifice' && SXT.lastBoard && SXT.lastBoard[r.pos] ? { pos: r.pos, tile: SXT.lastBoard[r.pos] } : null;
    opts.onHold && opts.onHold();
    _sxtStatus('');
    const big = sxT().revealScale;
    const land = r.kind === 'redeem' ? ['blessing'] : [R.col === '#ff6b6b' ? 'curse' : 'blessing'].concat(R.jack ? ['jackpot'] : []);
    await _sxtFlip(c, R.img, R.col, { base: 1.36, big, upsideDown: R.upsideDown, sparks: R.jack ? 34 : 22, sfx: opts.sfx, landSfx: land });
    const cap = document.createElement('div'); cap.className = 'sxt-cap';
    Object.assign(cap.style, { left: g.cx + 'px', top: (g.cy - 24 * g.k + g.h * big / 2 + 14 * g.k) + 'px', color: R.col, fontSize: Math.round(30 * g.k) + 'px', textShadow: `0 0 18px ${R.col}99, 0 2px 4px #000` });
    cap.innerHTML = `${R.title}${R.sub ? `<small>${R.sub}</small>` : ''}`;
    SXT.stage.appendChild(cap);
    await _sxtAnim(cap, [{ opacity: 0, transform: 'translate(-50%,10px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], 380);
    await new Promise(res => setTimeout(res, Math.max(0, sxD('result') - 380)));
    _sxtAnim(cap, [{ opacity: 1 }, { opacity: 0 }], 250);
    _sxtVign(false);
    const tEl = opts.tileEl && opts.tileEl(r.pos), tr = tEl && tEl.getBoundingClientRect();
    if (r.kind === 'redeem' || !tr) {
      ring(g.cx, g.cy - 24 * g.k, 160 * g.k, '#ffd77a', { dur: 1000, grow: 2.3, width: 4 });
      if (level !== 'reduced') sparks(g.cx, g.cy - 24 * g.k, '#ffd77a', 40, 320 * g.k, { dur: 1100, size: 6 });
      await _sxtAnim(c, [{ transform: c._t, opacity: 1 }, { transform: _sxtAt(g.cx, g.cy - 60 * g.k, big * 1.15), opacity: 0 }], sxD('settle'));
    } else {
      const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2, rot = r.pos / 28 * 360;
      opts.sfx && opts.sfx('fly');
      await _sxtAnim(c, [{ transform: c._t, opacity: 1 }, { transform: _sxtAt(tx, ty, .22, rot), opacity: .2 }], sxD('settle'), { ease: 'cubic-bezier(.55,0,.6,1)' });
      ring(tx, ty, 46 * g.k, R.col, { dur: 700, grow: 2, width: 3 });
      if (r.kind === 'sacrifice' && level !== 'reduced') sparks(tx, ty, '#ff6b6b', 20, 90 * g.k, { dur: 800, size: 5 });
      if (R.jack) { banner(tx, ty - 30 * g.k, `+${r.jackpot}✦`, '#ffe7a8', { size: 22, dur: 1500, rise: 40 }); if (level !== 'reduced') sparks(tx, ty, '#ffd77a', 22, 90 * g.k, { dur: 800, size: 5 }); }
    }
    SXT.hold = null; SXT.tileHold = null; opts.onHold && opts.onHold();
    c.remove(); SXT.state = 'revealed'; SXT.busy = false;
    opts.onRevealDone && opts.onRevealDone(sx.revealSeq);
  }
  function sxTable(G, opts = {}) {
    SXT.sfx = opts.sfx || null;
    const sx = G && G.sanction, ph = G ? String(G.phase) : '';
    const inTurn = ph.startsWith('sanction:') && sx;
    if (!inTurn) {
      // turn ended without a reveal (pass / skip / turn moved on): let a running reveal finish, otherwise drop the table
      if (SXT.stage && SXT.state !== 'revealing') SXT.q = SXT.q.then(() => { if (!G || !String(G.phase).startsWith('sanction:')) _sxtClear(true); });
      return;
    }
    if (sx.seq !== SXT.seq) {
      const instant = !!opts.instant;
      SXT.q = Promise.resolve().then(async () => {
        _sxtBuild(G, opts);
        if (instant || ph !== 'sanction:pick_tile') { _sxtPlace(false); if (ph !== 'sanction:pick_tile' && sx.pickedPos != null) { SXT.instantChoose = true; } }
        else await _sxtDeal();
      });
    }
    if (ph === 'sanction:pick_tile') {
      const want = sx.previewPos != null ? SXT.offers.indexOf(sx.previewPos) : null;
      SXT.q = SXT.q.then(async () => {
        if (SXT.seq !== sx.seq || SXT.state !== 'built') return;
        const w = want == null || want < 0 ? Math.min(1, SXT.cards.length - 1) : want;
        if (w !== SXT.idx) { SXT.idx = w; await _sxtPlace(true); }
      });
    } else if ((ph === 'sanction:own' || ph === 'sanction:omen' || ph === 'sanction:reveal') && SXT.state === 'built' || SXT.instantChoose) {
      if (SXT.state === 'built' || SXT.instantChoose) { SXT.state = 'choosing'; SXT.instantChoose = false; SXT.q = SXT.q.then(() => _sxtChoose(G, sx.pickedPos)); }
    }
    if (ph === 'sanction:own' || ph === 'sanction:omen') SXT.lastBoard = JSON.parse(JSON.stringify(G.board));   // pre-action snapshot
    if (ph === 'sanction:reveal' && (sx.revealSeq || 0) !== SXT.revealSeq) {
      SXT.revealSeq = sx.revealSeq || 0; SXT.state = SXT.state === 'chosen' || SXT.state === 'choosing' ? SXT.state : SXT.state;
      const snap = JSON.parse(JSON.stringify(G));   // reveal from the state at the moment of the action
      SXT.q = SXT.q.then(() => { SXT.state = 'revealing'; return _sxtReveal(snap, opts); });
    }
  }
  function sxFortuneHold() { return SXT.hold; }
  function sxTileHold() { return SXT.tileHold; }
  function sxBusy() { return !!SXT.busy || SXM.busy; }
  // ── v0.6.35: Sanctioned / Redeemed tarot moment (locked in the Sanction Moments Lab: speed 0.8, hold 1600) ──
  const SXM = { busy: false };
  const SXM_SPEED = 0.8, SXM_HOLD = 1600;
  const SXM_IMG = { back: '/img/omens/omen-back-omen.webp', sanc: '/img/omens/omen-sanctioned.webp', life: '/img/omens/omen-life.webp' };
  Object.values(SXM_IMG).forEach(src => { const i = new Image(); i.src = src; });
  async function sxMoment(kind, p, opts = {}) {
    SXM.busy = true;
    try { await _sxmRun(kind, p, opts); } catch (e) { console.warn('sxMoment', e); }
    SXM.busy = false; opts.onDone && opts.onDone();
  }
  async function _sxmRun(kind, p, opts) {
    const reduced = level === 'reduced', k = scale(), root = document.getElementById('scale-root');
    const R = root ? root.getBoundingClientRect() : { left: 0, top: 0 };
    const X = v => R.left + v * k, Y = v => R.top + v * k;
    const D = ms => ms / SXM_SPEED, wait = ms => new Promise(res => setTimeout(res, D(ms)));
    const A = (el, kf, ms, o = {}) => el.animate(kf, { duration: D(ms), easing: o.ease || 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished.catch(() => {});
    const W = 200 * k, H = 355 * k, CX = X(720), CY = Y(455);
    const at = (x, y, sc = 1, rot = 0) => `translate(${x - W / 2}px,${y - H / 2}px) scale(${sc}) rotate(${rot}deg)`;
    const sanc = kind === 'sanc', col = sanc ? '#ff5a5f' : '#ffd77a';
    const root2 = mk('sxm', { position: 'absolute', inset: '0' });
    const add = (tag, st, html) => { const e = document.createElement('div'); Object.assign(e.style, st); if (html) e.innerHTML = html; root2.appendChild(e); return e; };
    // veil + name
    const veil = add('', { position: 'absolute', inset: '0', opacity: 0, background: 'radial-gradient(ellipse at 50% 42%,rgba(11,12,26,.82),rgba(5,5,12,.96) 70%)' });
    A(veil, [{ opacity: 0 }, { opacity: 1 }], 450);
    const nm = add('', { position: 'absolute', left: CX + 'px', top: Y(78) + 'px', transform: 'translateX(-50%)', opacity: 0, whiteSpace: 'nowrap', textAlign: 'center',
      font: `900 ${46 * k}px Cinzel,serif`, letterSpacing: '.14em', color: p.color, textShadow: '0 2px 6px #000', filter: sanc ? 'none' : 'saturate(.1) brightness(.6)' },
      `<small style="display:block;font:600 ${12 * k}px Cinzel,serif;letter-spacing:.4em;color:#9397ab;margin-bottom:${6 * k}px">${sanc ? 'PLAYER' : 'SANCTIONED'}</small>${String(p.name).toUpperCase()}`);
    await A(nm, [{ opacity: 0, transform: `translate(-50%,${-24 * k}px)` }, { opacity: 1, transform: 'translate(-50%,0)' }], 450);
    // card
    const c = add('', { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', perspective: 1400 * k + 'px' });
    const face = (img, back) => `<div style="position:absolute;inset:0;border-radius:${12 * k}px;background:center/cover url('${img}');backface-visibility:hidden;${back ? 'transform:rotateY(180deg);' : ''}box-shadow:0 0 0 ${2 * k}px var(--gc,transparent),0 0 ${40 * k}px var(--gc,transparent),0 ${18 * k}px ${40 * k}px rgba(0,0,0,.8)"></div>`;
    c.innerHTML = `<div class="in" style="position:absolute;inset:0;transform-style:preserve-3d">${face(sanc ? SXM_IMG.back : SXM_IMG.sanc)}${face(sanc ? SXM_IMG.sanc : SXM_IMG.life, true)}</div>`;
    const inner = c.firstChild;
    if (!sanc) c.style.setProperty('--gc', 'rgba(255,90,95,.55)');
    await A(c, [{ transform: at(CX, Y(1300), 1.1, -8) }, { transform: at(CX, CY - 22 * k, 1.15, 1.5), offset: .8 }, { transform: at(CX, CY, 1.15) }], 620, { ease: 'cubic-bezier(.2,.9,.3,1)' });
    if (!sanc) opts.sfx && opts.sfx('redeem');
    // neutral build-up
    c.style.setProperty('--gc', 'rgba(216,210,255,.55)');
    let rays = null;
    if (!reduced) {
      const RR = 600 * k; rays = add('', { position: 'absolute', left: CX - RR + 'px', top: CY - RR + 'px', width: RR * 2 + 'px', height: RR * 2 + 'px', borderRadius: '50%', opacity: 0,
        background: 'repeating-conic-gradient(from 0deg,var(--rc) 0 6deg,transparent 6deg 22deg)', webkitMask: 'radial-gradient(circle,#000 0,transparent 62%)', mask: 'radial-gradient(circle,#000 0,transparent 62%)' });
      rays.style.setProperty('--rc', 'rgba(216,210,255,.2)');
      A(rays, [{ opacity: 0, transform: 'rotate(0) scale(.7)' }, { opacity: 1, transform: 'rotate(20deg) scale(1)', offset: .3 }, { opacity: 0, transform: 'rotate(50deg) scale(1.1)' }], 1800);
      await A(c, [...Array(11)].map((_, i) => ({ transform: at(CX + (i % 2 ? 2 : -2) * k * i / 10, CY - 14 * k * i / 10, 1.15 + .05 * i / 10, (i % 2 ? .9 : -.9) * i / 10) })), 900, { ease: 'linear' });
    } else await wait(450);
    if (sanc) opts.sfx && opts.sfx('sanctioned');
    // flip
    await Promise.all([
      reduced ? (inner.style.transform = 'rotateY(180deg)', Promise.resolve()) : A(inner, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], sanc ? 520 : 560, { ease: 'cubic-bezier(.5,0,.3,1)' }),
      A(c, [{ transform: at(CX, CY, 1.2) }, { transform: at(CX, CY - 24 * k, 1.38) }, { transform: at(CX, CY, 1.3) }], sanc ? 520 : 560),
    ]);
    // colour lands
    c.style.setProperty('--gc', col);
    if (rays) rays.style.setProperty('--rc', sanc ? 'rgba(255,90,95,.27)' : 'rgba(255,215,122,.33)');
    if (!reduced) {
      if (sanc && root) root.animate([...Array(8)].map((_, i) => ({ translate: `${(i % 2 ? 1 : -1) * 12 * (1 - i / 8)}px ${(i % 3 - 1) * 7 * (1 - i / 8)}px` })), { duration: D(420) });
      const F = 280 * k, fl = add('', { position: 'absolute', left: CX - F + 'px', top: CY - F + 'px', width: F * 2 + 'px', height: F * 2 + 'px', background: `radial-gradient(circle,${col} 0,transparent 60%)` });
      A(fl, [{ opacity: .9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.25)' }], 700);
      ring(CX, CY, 280 * k, col, { dur: D(900), grow: 2.2, width: 4 });
      sparks(CX, CY, sanc ? '#ff7a7a' : '#ffe7a8', sanc ? 26 : 44, (sanc ? 280 : 340) * k, { dur: D(1000), size: 6 });
      if (!sanc) { const RR = 600 * k, r2 = add('', { position: 'absolute', left: CX - RR + 'px', top: CY - RR + 'px', width: RR * 2 + 'px', height: RR * 2 + 'px', borderRadius: '50%', opacity: 0,
        background: 'repeating-conic-gradient(from 0deg,rgba(255,215,122,.27) 0 6deg,transparent 6deg 22deg)', webkitMask: 'radial-gradient(circle,#000 0,transparent 62%)', mask: 'radial-gradient(circle,#000 0,transparent 62%)' });
        A(r2, [{ opacity: 0, transform: 'rotate(0) scale(.7)' }, { opacity: 1, transform: 'rotate(20deg) scale(1)', offset: .3 }, { opacity: 0, transform: 'rotate(50deg) scale(1.1)' }], 2200); }
    }
    A(nm, [{ filter: sanc ? 'none' : 'saturate(.1) brightness(.6)' }, { filter: sanc ? 'saturate(.1) brightness(.6)' : 'none' }], 750);
    nm.firstChild.textContent = sanc ? 'SANCTIONED' : 'REDEEMED';
    if (!sanc) nm.style.textShadow = `0 0 ${24 * k}px ${p.color}, 0 2px 6px #000`;
    const cap = add('', { position: 'absolute', left: CX + 'px', top: Y(730) + 'px', transform: 'translateX(-50%)', opacity: 0, whiteSpace: 'nowrap', textAlign: 'center',
      font: `700 ${26 * k}px Cinzel,serif`, letterSpacing: '.3em', color: sanc ? '#ff8a80' : '#ffd77a', textShadow: '0 2px 6px #000' },
      `${sanc ? 'IS SANCTIONED' : 'IS REDEEMED'}<small style="display:block;font:500 ${15 * k}px Inter,sans-serif;letter-spacing:.02em;color:#c8c9d6;margin-top:${8 * k}px">${opts.sub || (sanc ? 'Out of Mana. No income, but they still take Sanction turns. Redeem to come back.' : 'Back in the game.')}</small>`);
    await A(cap, [{ opacity: 0, transform: `translate(-50%,${10 * k}px)` }, { opacity: 1, transform: 'translate(-50%,0)' }], 380);
    await wait(SXM_HOLD);
    [veil, nm, cap].forEach(e => A(e, [{ opacity: 1 }, { opacity: 0 }], 400));
    // fly into the standings chip
    const chip = opts.chipEl && opts.chipEl(), cr = chip && chip.getBoundingClientRect();
    if (cr && cr.width) {
      await A(c, [{ transform: at(CX, CY, 1.3), opacity: 1 }, { transform: at(cr.left + 18 * k, cr.top + cr.height / 2, .08, -30), opacity: .4 }], 620, { ease: 'cubic-bezier(.55,0,.6,1)' });
      opts.onLand && opts.onLand();
      const ch = opts.chipEl && opts.chipEl();
      if (ch) ch.animate([{ transform: 'scale(1.12)', boxShadow: `0 0 24px ${col}` }, { transform: 'scale(1)' }], { duration: D(450) });
    } else { await A(c, [{ opacity: 1 }, { opacity: 0 }], 400); opts.onLand && opts.onLand(); }
    root2.remove();
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
    wcTable, wcTableConsume,   // v0.6.26
    ring, sparks,              // v0.6.30: exposed for the board's Wheel of Fortune flip
    sxTable, sxFortuneHold, sxTileHold, sxBusy, sxMoment,   // v0.6.31: Sanction card table (v0.6.32: sxTileHold)
    get level() { return level; },
    setLevel(v) { level = v === 'reduced' ? 'reduced' : 'full'; try { localStorage.setItem(LS_KEY, level); } catch (e) {} },
  };
})();

// moments.js — v0.6.25 — big-moment animations for the board view:
//   SGMoments.penultimate(), SGMoments.final(), SGMoments.gameOver(onHandoff)
// Pure visuals. Sound and server signalling stay in board.html (_fireRoundCallout / _fireGameOverFanfare).
// Draws a fixed full-viewport overlay (#sg-moment) above everything; a 16:10 stage inside it uses cqw units.
// Respects BoardFX.level === 'reduced' and prefers-reduced-motion (simple fade, no shake/flash/particles).
(function () {
  const ART = {
    penultimate: '/img/logos/logo-penultimate.webp',
    final:       '/img/logos/logo-finalround.webp',
    gameover:    '/img/logos/logo-gameover.webp',
  };
  // preload so the first frame isn't blank
  Object.values(ART).forEach(src => { const i = new Image(); i.src = src; });

  const css = `
#sg-moment{position:fixed;inset:0;z-index:650;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden}
#sg-moment .sgm-back{position:absolute;inset:0;opacity:0}
#sg-moment .sgm-stage{position:relative;width:min(100vw,160vh);aspect-ratio:16/10;container-type:inline-size}
#sg-moment canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:7;pointer-events:none}
#sg-moment .sgm-flash,#sg-moment .sgm-rays,#sg-moment .sgm-ring,#sg-moment .sgm-vig,#sg-moment .sgm-sweep{position:absolute;pointer-events:none;opacity:0}
#sg-moment .sgm-flash{position:fixed;inset:0;z-index:8;background:#fff;mix-blend-mode:screen}
#sg-moment .sgm-vig{position:fixed;inset:0;z-index:6}
#sg-moment .sgm-rays{left:50%;top:50%;width:140cqw;height:140cqw;margin:-70cqw 0 0 -70cqw;z-index:2;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(255,215,140,.22) 0deg 5deg,transparent 5deg 15deg);
  -webkit-mask:radial-gradient(closest-side,#000 15%,transparent 70%);mask:radial-gradient(closest-side,#000 15%,transparent 70%)}
#sg-moment .sgm-ring{left:50%;top:50%;width:20cqw;height:20cqw;margin:-10cqw 0 0 -10cqw;border-radius:50%;z-index:3;border:.5cqw solid rgba(255,220,150,.9);box-shadow:0 0 3cqw rgba(255,200,120,.8),inset 0 0 2cqw rgba(255,200,120,.6)}
#sg-moment .sgm-lg{position:absolute;left:50%;top:50%;z-index:5;transform:translate(-50%,-50%);opacity:0;will-change:transform,opacity,filter}
#sg-moment .sgm-lg img{display:block;width:100%}
#sg-moment .sgm-sweep{inset:0;z-index:6;-webkit-mask-size:100% 100%;mask-size:100% 100%;background:linear-gradient(105deg,transparent 35%,rgba(255,250,230,.85) 50%,transparent 65%) no-repeat;background-size:250% 100%;mix-blend-mode:overlay}
#sg-moment .sgm-sub{position:absolute;left:0;right:0;z-index:5;text-align:center;font-family:'Cinzel',serif;letter-spacing:.35em;text-transform:uppercase;color:#efe6ff;opacity:0;text-shadow:0 0 1cqw rgba(0,0,0,.9)}
#sg-moment.out{transition:opacity .45s ease;opacity:0}

/* penultimate */
#sg-moment.pen .sgm-back{background:radial-gradient(ellipse at center,rgba(30,12,60,.55),rgba(5,3,10,.9));backdrop-filter:saturate(.35) brightness(.75) blur(2px);-webkit-backdrop-filter:saturate(.35) brightness(.75) blur(2px);animation:sgmFadeHold 4s ease both}
#sg-moment.pen .sgm-lg{width:50cqw;animation:sgmPenDrop 4s both}
#sg-moment.pen .sgm-ring{animation:sgmRing 1.1s ease-out .55s both}
#sg-moment.pen .sgm-rays{animation:sgmRaysIn 4s ease both .5s}
#sg-moment.pen .sgm-sweep{animation:sgmSweep 1.1s ease-in-out 1.3s both}
#sg-moment.pen .sgm-sub{bottom:6cqw;font-size:1.3cqw;animation:sgmSubIn 4s ease both}

/* final */
#sg-moment.fin .sgm-back{background:#05030a;backdrop-filter:saturate(.2) brightness(.5) blur(3px);-webkit-backdrop-filter:saturate(.2) brightness(.5) blur(3px);animation:sgmFinVeil 5s ease both}
#sg-moment.fin .sgm-flash{animation:sgmLightning 5s linear both}
#sg-moment.fin .sgm-lg{width:56cqw;animation:sgmFinSlam 5s cubic-bezier(.2,.8,.25,1) both}
#sg-moment.fin .sgm-ring{animation:sgmRing 1s ease-out 1.42s both}
#sg-moment.fin .sgm-ring.r2{animation:sgmRing 1.3s ease-out 1.6s both;border-color:rgba(200,120,255,.9);box-shadow:0 0 3cqw rgba(180,90,255,.8)}
#sg-moment.fin .sgm-rays{animation:sgmRaysIn 5s ease both 1.4s,sgmSpin 14s linear infinite}
#sg-moment.fin .sgm-vig{background:radial-gradient(ellipse at center,transparent 45%,rgba(190,30,60,.55) 100%);animation:sgmHeartbeat 5s ease both 1.4s}
#sg-moment.fin .sgm-sweep{animation:sgmSweep 1s ease-in-out 2.4s both}
#sg-moment.fin .sgm-sub{bottom:5cqw;font-size:1.4cqw;color:#ffd9a0;animation:sgmSubIn2 5s ease both}

/* game over (overlay part — results are the winners screen underneath) */
#sg-moment.gom .sgm-back{background:rgba(3,2,8,.95);animation:sgmGoVeil 4.6s ease both}
#sg-moment.gom .sgm-flash{background:radial-gradient(circle at 50% 40%,#fff2c8,transparent 60%);animation:sgmGoFlash 4.6s ease both}
#sg-moment.gom .sgm-rays{top:40%;background:repeating-conic-gradient(from 0deg,rgba(255,225,160,.28) 0deg 4deg,transparent 4deg 12deg);animation:sgmRaysGo 4.6s ease both,sgmSpin 30s linear infinite}
#sg-moment.gom .sgm-lg{width:44cqw;top:42%;animation:sgmGoCrown 4.6s cubic-bezier(.3,.7,.2,1) both}
#sg-moment.gom .sgm-ring{top:42%;animation:sgmRing 1.4s ease-out 2.2s both}
#sg-moment.gom .sgm-sweep{animation:sgmSweep 1.1s ease-in-out 2.6s both}

/* reduced */
#sg-moment.reduced .sgm-back{animation:sgmFadeHold 1s ease both!important}
#sg-moment.reduced .sgm-lg{animation:sgmSimple 1s ease both!important}
#sg-moment.reduced .sgm-sub{animation:sgmFadeHold 1s ease both .3s!important}
#sg-moment.reduced .sgm-rays,#sg-moment.reduced .sgm-ring,#sg-moment.reduced .sgm-flash,#sg-moment.reduced .sgm-vig,#sg-moment.reduced .sgm-sweep{display:none}

@keyframes sgmPenDrop{0%{opacity:0;transform:translate(-50%,-160%) rotate(-6deg) scale(.9)}12%{opacity:1}16%{transform:translate(-50%,-46%) rotate(1deg) scale(1.04,.94)}22%{transform:translate(-50%,-53%) rotate(-.5deg) scale(.98,1.03)}28%{transform:translate(-50%,-50%) rotate(0) scale(1)}100%{opacity:1;transform:translate(-50%,-50%) rotate(0) scale(1.04)}}
@keyframes sgmSubIn{0%,30%{opacity:0;letter-spacing:.9em}45%,100%{opacity:1;letter-spacing:.35em}}
@keyframes sgmFinVeil{0%{opacity:0}6%,26%{opacity:.97}36%,100%{opacity:.6}}
@keyframes sgmLightning{0%,9%{opacity:0}10%{opacity:.9}11%{opacity:0}13%{opacity:.6}14%,19%{opacity:0}20%{opacity:.75}21.5%{opacity:0}28%{opacity:.95}32%,100%{opacity:0}}
@keyframes sgmFinSlam{0%,26%{opacity:0;transform:translate(-50%,-50%) scale(3.2);filter:blur(1.2cqw) brightness(3)}28.5%{opacity:1;transform:translate(-50%,-50%) scale(.92);filter:blur(0) brightness(2)}32%{transform:translate(-50%,-50%) scale(1.05);filter:blur(0) brightness(1.3)}36%{transform:translate(-50%,-50%) scale(1);filter:blur(0) brightness(1)}100%{opacity:1;transform:translate(-50%,-50%) scale(1.06);filter:blur(0) brightness(1)}}
@keyframes sgmHeartbeat{0%{opacity:0}8%{opacity:1}14%{opacity:.3}20%{opacity:.9}30%{opacity:.25}45%{opacity:.8}52%{opacity:.25}58%{opacity:.7}70%,100%{opacity:.35}}
@keyframes sgmSubIn2{0%,38%{opacity:0;transform:translateY(1cqw)}48%,100%{opacity:1;transform:none}}
@keyframes sgmSpin{to{rotate:360deg}}
@keyframes sgmGoVeil{0%{opacity:0}15%,100%{opacity:1}}
@keyframes sgmRaysGo{0%,20%{opacity:0}45%{opacity:1}100%{opacity:.7}}
@keyframes sgmGoFlash{0%,44%{opacity:0}47%{opacity:.85}66%,100%{opacity:0}}
@keyframes sgmGoCrown{0%,15%{opacity:0;transform:translate(-50%,-90%) scale(.85);filter:brightness(0)}46%{opacity:1;transform:translate(-50%,-50%) scale(1.02);filter:brightness(1.6)}54%{filter:brightness(1)}100%{opacity:1;transform:translate(-50%,-50%) scale(1.06);filter:brightness(1)}}
@keyframes sgmFadeHold{0%{opacity:0}12%,100%{opacity:1}}
@keyframes sgmSimple{0%{opacity:0;transform:translate(-50%,-50%) scale(.96)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes sgmRing{0%{opacity:0;transform:scale(.3)}2%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(7)}}
@keyframes sgmRaysIn{0%{opacity:0;transform:scale(.6)}25%{opacity:1;transform:scale(1)}100%{opacity:.6;transform:scale(1.1)}}
@keyframes sgmSweep{0%{opacity:1;background-position:150% 0}100%{opacity:1;background-position:-50% 0}}

/* winners screen entrance (applied by board.html after the game-over hand-off) */
.winners-overlay.go-enter .winners-logo{animation:sgmPop .01s both}
.winners-overlay.go-enter .winners-eyebrow,.winners-overlay.go-enter .winners-title{animation:sgmPop .5s ease both .15s}
.winners-overlay.go-enter .winners-champion{animation:sgmStamp .6s cubic-bezier(.2,1.4,.4,1) both .35s}
.winners-overlay.go-enter .winners-champion-sub{animation:sgmPop .5s ease both .85s}
.winners-overlay.go-enter .wt-head{animation:sgmPop .4s ease both 1s}
.winners-overlay.go-enter .wt-cell{animation:sgmRowIn .5s ease both calc(1.15s + var(--r,0) * .18s)}
.winners-overlay.go-enter .winners-actions{animation:sgmPop .5s ease both calc(1.5s + var(--n,3) * .18s)}
@keyframes sgmStamp{0%{opacity:0;transform:scale(2.4)}60%{opacity:1;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}
@keyframes sgmRowIn{0%{opacity:0;transform:translateX(-24px)}100%{opacity:1;transform:none}}
@keyframes sgmPop{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.winners-overlay.go-enter *{animation-duration:.01s!important;animation-delay:0s!important}}
`;
  const st = document.createElement('style'); st.id = 'sg-moments-css'; st.textContent = css;
  document.head.appendChild(st);

  function reduced() {
    return (window.BoardFX && BoardFX.level === 'reduced') ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ── particles ─────────────────────────────────────────────
  function particles(canvas) {
    const x = canvas.getContext('2d'); let P = [], bolts = [], raf = 0, W = 0, H = 0, until = 0;
    const d = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * d; canvas.height = H * d; x.setTransform(d, 0, 0, d, 0, 0);
    const k = Math.min(W, H * 1.6) / 900;
    const api = {
      burst(n, o) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (o.speed || 8) * (.35 + Math.random()); P.push({ x: W * (o.x ?? .5), y: H * (o.y ?? .5), vx: Math.cos(a) * s * k, vy: Math.sin(a) * s * k, g: o.g ?? .12, life: o.life || 60, age: 0, sz: (o.sz || 5) * (.5 + Math.random()) * k, col: o.cols[i % o.cols.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .3, shape: o.shape || 'shard', drag: o.drag ?? .97 }); } go(); },
      rain(n, o) { for (let i = 0; i < n; i++) P.push({ x: Math.random() * W, y: -20 - Math.random() * H * (o.spread || .3), vx: (Math.random() - .5) * k, vy: (o.v || 2) * (.5 + Math.random()) * k, g: o.g ?? .03, life: o.life || 200, age: 0, sz: (o.sz || 4) * (.5 + Math.random()) * k, col: o.cols[i % o.cols.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .2, shape: o.shape || 'conf', drag: .995, wob: Math.random() * 6 }); go(); },
      rise(n, o) { for (let i = 0; i < n; i++) P.push({ x: Math.random() * W, y: H * (.55 + Math.random() * .5), vx: (Math.random() - .5) * k, vy: -(o.v || 2) * (.8 + Math.random()) * k, g: -.005, life: o.life || 160, age: 0, sz: (o.sz || 2.5) * (.5 + Math.random()) * k, col: o.cols[i % o.cols.length], rot: 0, vr: 0, shape: 'ember', drag: .995, wob: Math.random() * 6 }); go(); },
      bolt() { const pts = []; let px = W * (.2 + Math.random() * .6), py = 0; pts.push([px, py]); while (py < H * .85) { px += (Math.random() - .5) * W * .08; py += H * (.05 + Math.random() * .06); pts.push([px, py]); } bolts.push({ pts, age: 0 }); go(); },
      stop() { P = []; bolts = []; if (raf) cancelAnimationFrame(raf); raf = 0; },
    };
    function go() { if (!raf) raf = requestAnimationFrame(draw); }
    function draw() {
      x.clearRect(0, 0, W, H);
      bolts = bolts.filter(b => b.age++ < 9);
      for (const b of bolts) { x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = `rgba(220,200,255,${1 - b.age / 9})`; x.shadowColor = '#b48cff'; x.shadowBlur = 20; x.lineWidth = Math.max(1.5, W / 400); x.beginPath(); b.pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.restore(); }
      P = P.filter(p => p.age++ < p.life && p.y < H + 40 && p.y > -H);
      for (const p of P) {
        p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx + (p.wob != null ? Math.sin((p.age + p.wob * 10) / 12) * .4 : 0); p.y += p.vy; p.rot += p.vr;
        const a = Math.min(1, (p.life - p.age) / 20); x.save(); x.globalAlpha = a; x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.col;
        if (p.shape === 'shard') { x.beginPath(); x.moveTo(0, -p.sz * 1.6); x.lineTo(p.sz * .6, 0); x.lineTo(0, p.sz * 1.6); x.lineTo(-p.sz * .6, 0); x.closePath(); x.fill(); x.globalAlpha = a * .5; x.fillStyle = '#fff'; x.fillRect(-p.sz * .12, -p.sz * 1.2, p.sz * .24, p.sz * 1.2); }
        else if (p.shape === 'conf') { x.fillRect(-p.sz / 2, -p.sz / 4, p.sz, p.sz / 2 * Math.abs(Math.cos(p.age / 6))); }
        else { x.globalCompositeOperation = 'lighter'; x.shadowColor = p.col; x.shadowBlur = p.sz * 4; x.beginPath(); x.arc(0, 0, p.sz, 0, 7); x.fill(); }
        x.restore();
      }
      raf = (P.length || bolts.length) ? requestAnimationFrame(draw) : 0;
    }
    return api;
  }

  const GEMS = ['#f2a33a', '#a35cff', '#3fc4e8', '#47d17a', '#ff5d8f', '#ffd77a'];
  let cur = null;   // { el, timers[], fx }

  function clear() {
    if (!cur) return;
    cur.timers.forEach(clearTimeout); if (cur.fx) cur.fx.stop();
    const el = cur.el; cur = null;
    if (el && el.isConnected) el.remove();
  }

  function shake(big) {
    const root = document.getElementById('scale-root');
    const stage = document.querySelector('#sg-moment .sgm-stage');
    const k = big ? 1 : .5;
    const frames = [0, -1.2, 1.4, -1.1, 1, -.6, .4, -.2, 0].map((v, i) => ({ translate: `${v * 14 * k}px ${(i % 2 ? -1 : 1) * Math.abs(v) * 7 * k}px` }));
    const opts = { duration: big ? 700 : 500, easing: 'cubic-bezier(.36,.07,.19,.97)' };
    // `translate` composes with scaleRoot()'s transform, so the board itself shakes
    [root, stage].forEach(el => { try { el && el.animate(frames, opts); } catch (e) {} });
  }

  function build(kind, art, alt, sub, extra) {
    clear();
    const el = document.createElement('div');
    el.id = 'sg-moment';
    el.className = kind + (reduced() ? ' reduced' : '');
    el.innerHTML = `<div class="sgm-back"></div><div class="sgm-vig"></div>
      <div class="sgm-stage"><div class="sgm-rays"></div><div class="sgm-ring"></div>${extra || ''}
        <div class="sgm-lg"><img src="${art}" alt="${alt}"><div class="sgm-sweep" style="-webkit-mask-image:url(${art});mask-image:url(${art})"></div></div>
        ${sub ? `<div class="sgm-sub">${sub}</div>` : ''}</div>
      <div class="sgm-flash"></div><canvas></canvas>`;
    document.body.appendChild(el);
    cur = { el, timers: [], fx: reduced() ? null : particles(el.querySelector('canvas')) };
    return cur;
  }
  function at(c, ms, fn) { c.timers.push(setTimeout(() => { if (cur === c) fn(); }, ms)); }
  function fadeOutAt(c, ms) { at(c, ms, () => { c.el.classList.add('out'); at(c, 470, clear); }); }

  // holdMs = how long the callout stays fully on screen before fading (board.html owns the timing)
  function penultimate(holdMs, sub) {
    const c = build('pen', ART.penultimate, 'One Round Left', sub || 'One more round after this');
    if (c.fx) {
      at(c, 550, () => { c.fx.burst(70, { cols: GEMS, speed: 14, sz: 7, life: 70, g: .18 }); shake(false); });
      at(c, 700, () => c.fx.burst(40, { cols: ['#ffe3a0', '#fff'], speed: 9, sz: 2.5, life: 50, shape: 'spark', g: 0 }));
      at(c, 900, () => c.fx.rain(70, { cols: ['#e9c37a', '#c79a4a', '#f6deb0'], v: 1.2, sz: 1.8, shape: 'sand', life: 220, g: .008 }));
    }
    fadeOutAt(c, holdMs || 3500);
  }

  function final(holdMs, sub) {
    const c = build('fin', ART.final, 'Final Round', sub || 'This is the last round', '<div class="sgm-ring r2"></div>');
    if (c.fx) {
      at(c, 400, () => c.fx.bolt());
      at(c, 880, () => c.fx.bolt());
      at(c, 1420, () => {
        c.fx.burst(110, { cols: GEMS, speed: 20, sz: 8, life: 80, g: .16 });
        c.fx.burst(60, { cols: ['#fff', '#ffe0a0'], speed: 14, sz: 2.5, life: 45, shape: 'spark', g: 0 });
        shake(true);
      });
      at(c, 1500, () => c.fx.rise(90, { cols: ['#ff9a3c', '#ffcc66', '#ff5d5d', '#c58bff'], v: 2.4, life: 240 }));
      at(c, 2600, () => c.fx.rise(60, { cols: ['#ff9a3c', '#ffcc66', '#c58bff'], v: 2, life: 220 }));
    }
    fadeOutAt(c, holdMs || 4500);
  }

  // Game over: blackout → rays → crown descends + flash + confetti → logo flies to the winners
  // screen's logo slot (target found by selector) and the overlay fades, then onHandoff() runs.
  function gameOver(onHandoff, playerColors) {
    const c = build('gom', ART.gameover, 'Game Over', '');
    const cols = ['#ffd77a', '#fff1c4', '#c58bff'].concat(playerColors || ['#e2554c', '#4f9be0', '#4cc070']);
    const HANDOFF = reduced() ? 1200 : 4200;
    if (c.fx) {
      at(c, 2150, () => { c.fx.burst(90, { cols: ['#ffd77a', '#fff1c4', '#c58bff'], speed: 12, sz: 3, life: 70, shape: 'spark', g: .02, y: .42 }); shake(false); });
      at(c, 2300, () => c.fx.rain(160, { cols, v: 2.6, sz: 6, spread: .6, life: 320 }));
      at(c, 3600, () => c.fx.rain(90, { cols, v: 2.4, sz: 6, spread: .4, life: 300 }));
    }
    at(c, HANDOFF, () => {
      const lg = c.el.querySelector('.sgm-lg');
      const target = document.querySelector('.winners-overlay .winners-logo');
      if (target) target.style.visibility = 'hidden';
      if (onHandoff) { try { onHandoff(); } catch (e) { console.warn('[moments] handoff', e); } }
      const back = c.el.querySelector('.sgm-back'), rays = c.el.querySelector('.sgm-rays');
      [back, rays].forEach(e => { if (e) { e.style.transition = 'opacity .7s ease'; e.style.animation = 'none'; e.style.opacity = getComputedStyle(e).opacity; void e.offsetWidth; e.style.opacity = 0; } });
      if (target && lg && !reduced()) {
        const a = lg.getBoundingClientRect(), b = target.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2), s = b.width / a.width;
        const startT = getComputedStyle(lg).transform;
        lg.style.animation = 'none'; lg.style.opacity = 1; lg.style.transform = startT;
        const anim = lg.animate([{ transform: startT }, { transform: `translate(${dx}px,${dy}px) ${startT === 'none' ? '' : startT} scale(${s})` }],
          { duration: 750, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
        anim.onfinish = () => { target.style.visibility = ''; clear(); };
        at(c, 1200, () => { target.style.visibility = ''; clear(); });  // safety
      } else {
        if (target) target.style.visibility = '';
        c.el.classList.add('out'); at(c, 470, clear);
      }
    });
  }

  window.SGMoments = { penultimate, final, gameOver, clear, version: 'v0.6.25' };
})();

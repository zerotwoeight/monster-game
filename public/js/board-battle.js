// board-battle.js v0.6.99 (2026-11-15): _bdStrike hooks for 3D battle dice callouts (no-op unless board-battledice3d.js is loaded). board-battle.js: split from the inline page script (L2). Loaded in order by board.html; all files share one global scope.
// ─── Battle hit animation helpers ───────────────────────────────────────────────────────────

function playCardHitAnim(cardEl, animFile) {
  if (!cardEl || !animFile || typeof lottie === 'undefined') return;
  // Play matching SFX
  if      (animFile === 'Hit_Slash') _playSfx(_sfxHitSlash);
  else if (animFile === 'Hit_Magic') _playSfx(_sfxHitMagic);
  else if (animFile === 'Hit_Claw')  _playSfx(_sfxHitClaw);
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;width:330px;height:330px;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:30;filter:brightness(0) invert(1);';
  cardEl.style.position = 'relative';
  cardEl.appendChild(container);
  const anim = lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    path: `/animations/${animFile}.json`
  });
  anim.addEventListener('complete', () => {
    anim.destroy();
    container.remove();
  });
}
// ────────────────────────────────────────────────────────────────────────────────────────────

// ─── HP bar animator (used in battle sequence) ───────────────────────────────────────────────
function animateHpBar(cardEl, monster, newHp) {
  const c = (monster.rarity === 'support') ? '#9aabbc' : (TYPE_COLOR[monster.type] || '#9184d9');
  const hp = Math.max(0, newHp);
  const pct = Math.max(0, Math.min(1, hp / monster.maxHp));
  const hpColor = pct < .35 ? '#b05050' : c;
  const fill = cardEl.querySelector('.mc-hp-fill');
  const num  = cardEl.querySelector('.mc-hp-num');
  if (fill) { fill.style.width = Math.round(pct * 100) + '%'; fill.style.background = hpColor; }
  if (num)  { num.textContent = hp + '/' + monster.maxHp; }
  // Flash the bar red briefly for drama
  if (fill) {
    fill.animate([
      {filter:'brightness(2.5) saturate(.2)'},
      {filter:'brightness(1) saturate(1)'}
    ], {duration: 480, easing:'ease'});
  }
}

// ─── v0.6.88: battle staging variables (Polish Plan stage 2) ────────────────────────────────────────────────
// Tuned in /battle-lab.html (public/battle-lab.html + js/battle-lab.js); the values here are what the game uses.
// If the fight gets longer or shorter, change BATTLE_FIGHT_MS in server/08-handlers.js to match (the server
// decides how long the result stays up).
// mode 'classic' = the look before v0.6.88 (full dark sheet, cards slide in). mode 'ring' = the fight stays in
// the round arena the "Battle Engaged" preview used: the preview cards carry over and grow, the ring of tiles
// stays visible under a lighter dim, and the tile being fought over is left lit.
const BATTLE_STAGE = {
  // ── v0.6.90: PINNED 2026-11-13 from the Battle Lab (Polish Plan stages 2 + 3). Before that the game ran
  //    mode 'classic', dim .9, cardScale 1, gap 36, text 11 / 9 / 11 / 22 / 38, shake off, impact off.
  // Stage 2 — staging
  mode: 'ring',        // 'ring' = fight in the round arena the preview used; 'classic' = full dark sheet, cards slide in
  dim: 0.9,            // darkness over the board (classic: the whole sheet; ring: outside the arena)
  discSize: 550,       // ring: arena diameter in px (the preview's is 480; the ring of tiles starts at ~490)
  discAlpha: 1,        // ring: how solid the arena is
  previewScale: 1,     // ring: card size in the "Battle Engaged" preview
  cardScale: 1.25,     // card size during the fight
  gap: 16,             // px between the two fighters
  handoff: true,       // ring: fight cards start where the preview cards were and grow into place
  handoffMs: 100,
  tileSpot: true,      // ring: leave the contested tile lit through the dim
  spotRadius: 170,
  tilePlate: true,     // ring: "Tile 12 · Dark" under the fighters
  titleSize: 26, nameSize: 11, effSize: 20, dmgSize: 73, outcomeSize: 66,
  // Stage 3 — screen shake on every hit (both layouts)
  shake: true,
  shakePx: 20,         // how far the whole screen jolts
  shakeMs: 430,        // how long
  shakeByDamage: true, // bigger hits jolt harder (×0.5 at ~8 damage … ×2 at 60+)
  // Stage 3 — hit choreography. impact:false = the plain strikes from before v0.6.89.
  impact: true,
  timeScale: 1,        // lab only: 2 = half speed, 4 = quarter speed. Keep 1 in the game.
  windupMs: 180, windupPx: 16,       // pull back before the strike
  lungeMs: 140, lungePx: 46,         // the strike itself
  lungeByDamage: true,               // bigger hits travel further and knock back harder
  hitStopMs: 70,                     // freeze on contact
  recoverMs: 280,                    // striker returns
  betweenMs: 380,                    // pause before the counter-strike
  cardShakePx: 20,                   // knock-back of the card that was hit
  flash: true,                       // white flash on the card that was hit
  stamp: true, stampSize: 22,        // "2× STRONG" / "RESISTED" on the card that was hit
  dmgByDamage: true, dmgHoldMs: 1000, // damage number grows with the hit; how long it stays
  hpDrainMs: 650, hpGhost: true,     // HP bar drains, with a pale bar trailing behind
  deathStyle: 'crumble',             // 'crumble' = one death for everyone (the user's pick); 'element' = a death per type (built, in the lab)
  deathMs: 800,
  winnerPulse: true, winnerCenter: true, winnerScale: 1.1, winnerMs: 600,   // the survivor steps to the middle and glows
  outcomeDelayMs: 150,               // beat before "Victory!"
  // v0.6.97: ability / effect callouts (Soul Siphon, Auras, Home Ground…). 'under' = below each card (the game today;
  // they collide with the outcome text in the ring layout). 'side' = beside each card, on its outer side. Tuned in the Battle Lab.
  fxPlace: 'side',     // v0.6.98: PINNED 2026-11-15 (user's pick in the Battle Lab)
  fxGap: 18,           // side: px between the card and its callouts
  fxWidth: 230,        // side: width of the callout column
  fxAlign: 'middle',   // side: 'top' / 'middle' / 'bottom' of the card
  fxScale: 1,          // size of the callouts
  fxFollow: false,     // side: the winner's callouts travel with it when it steps to the middle (off: they hold the stalemate layout)
};
// v0.6.97: where each side's callout column sits
function _bsFxStyle(side, ring) {
  const S = BATTLE_STAGE, z = S.fxScale && S.fxScale !== 1 ? `zoom:${S.fxScale};` : '';
  if (S.fxPlace === 'side') {
    const v = S.fxAlign === 'top' ? 'top:22px;' : S.fxAlign === 'bottom' ? 'bottom:0;' : 'top:50%;transform:translateY(-50%);';
    return ` style="position:absolute;${v}${side === 'att' ? 'right' : 'left'}:calc(100% + ${S.fxGap}px);width:${S.fxWidth}px;margin-top:0;z-index:6;${z}"`;
  }
  return ring ? ` style="position:absolute;top:100%;left:50%;transform:translateX(-50%);${z}"` : (z ? ` style="${z}"` : '');
}
// Whole-screen jolt for a battle hit. Same method as the big moments: the CSS `translate` property on #scale-root
// (never `transform`, which holds the page scale). Nothing in Reduced effects.
function _bsShake(dmg) {
  const S = BATTLE_STAGE;
  if (!S.shake || !(S.shakePx > 0) || !(dmg > 0)) return;
  try { if ((window.BoardFX && BoardFX.level === 'reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  const root = document.getElementById('scale-root'); if (!root) return;
  const px = S.shakePx * (S.shakeByDamage ? Math.max(0.5, Math.min(2, dmg / 30)) : 1);
  const f = [], n = Math.max(4, Math.round(S.shakeMs / 35));
  for (let i = 0; i < n; i++) { const d = 1 - i / n; f.push({ translate: `${((Math.random() * 2 - 1) * px * d).toFixed(1)}px ${((Math.random() * 2 - 1) * px * d).toFixed(1)}px` }); }
  f.push({ translate: '0px 0px' });
  try { root.animate(f, { duration: S.shakeMs, easing: 'linear', composite: 'add' }); } catch (e) {}
}
let _bsPrev = null;   // where the preview cards were on screen, taken just before each redraw
function _bsCachePreview() {
  const a = document.querySelector('.battle-center.visible .bs-prev-att'), d = document.querySelector('.battle-center.visible .bs-prev-def');
  if (a && d) _bsPrev = { t: Date.now(), att: a.getBoundingClientRect(), def: d.getBoundingClientRect() };
}

// ─── v0.6.91: "Denied" jabs — one line per jab in /jabs.txt (edit it freely; blank lines and lines starting with # are skipped).
// Read once when the board loads; the six below are the fallback if the file is missing or empty.
let _JABS = ['The better player won today.', 'Winners keep winning.', 'Same result, different tile.', 'Maybe next time.', 'Some grudges just get heavier.', 'Still not your day.'];
try {
  fetch('/jabs.txt?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => {
    const lines = String(t || '').split(/\r?\n/).map(s => s.trim()).filter(s => s && s[0] !== '#');
    if (lines.length) _JABS = lines;
  }).catch(() => {});
} catch (e) {}
const _jabSeen = { key: null, text: '', last: -1 };
function _jabFor(lb) {   // one jab per battle (the same one if the overlay is redrawn), never the same twice running
  const key = (G ? G.turnCount : 0) + '|' + lb.attackerIdx + '|' + lb.atkDmg + '|' + lb.defDmg;
  if (_jabSeen.key === key) return _jabSeen.text;
  let i = Math.floor(Math.random() * _JABS.length);
  if (i === _jabSeen.last && _JABS.length > 1) i = (i + 1) % _JABS.length;
  _jabSeen.key = key; _jabSeen.last = i;
  return (_jabSeen.text = String(_JABS[i]).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])));
}

// ─── 5-beat battle animation ────────────────────────────────────────────────────────────────
async function runBattleAnimation(lb, attPlayer, defPlayer, overlay) {
  const stormtalonDefending = lb.defM && lb.defM.id === 'stormtalon';
  const hasCounter = lb.outcome === 'defender_wins' || lb.outcome === 'stalemate' || (stormtalonDefending && lb.atkDmg > 0);
  const attCrumbles = lb.outcome === 'defender_wins' || lb.outcome === 'mutual';
  const defCrumbles = lb.outcome === 'attacker_wins' || lb.outcome === 'mutual';
  const isStalemate = lb.outcome === 'stalemate';
  let outcomeLabel = {attacker_wins:'Victory!',defender_wins:'Defeated!',mutual:'Mutual Destruction!',stalemate:'Stalemate!'}[lb.outcome] || lb.outcome;
  let outcomeColor = {attacker_wins:'#5dc97d',defender_wins:'#e05252',mutual:'#e0b050',stalemate:'#9184d9'}[lb.outcome] || 'var(--accent-lit)';
  // v0.6.91: Rivalry callouts (server v1.0.158) — REVENGE takes the outcome text; DENIED + a jab, streaks and "streak ended" sit under it (two lines at most)
  const _rv = lb.rivalry || {}, _rvP = i => (G && G.players ? G.players.find(q => q.idx === i) : null) || { name: '?', color: '#c9c7e0' };
  const _rvLines = [];
  if (_rv.revenge) {
    const w = _rvP(_rv.revenge.idx), l = _rvP(_rv.revenge.on);
    outcomeLabel = _rv.revenge.n > 1 ? `Revenge ×${_rv.revenge.n}` : 'Revenge!'; outcomeColor = w.color || outcomeColor;
    _rvLines.push(`<div style="font:600 .24em Inter,sans-serif;letter-spacing:.06em;color:#e6e2f5;text-shadow:0 2px 4px rgba(0,0,0,.8);margin-top:.35em"><span style="color:${w.color}">${w.name}</span> settles the score with <span style="color:${l.color}">${l.name}</span></div>`);
  }
  if (_rv.denied) {
    const w = _rvP(_rv.denied.idx);
    _rvLines.push(`<div style="margin-top:.2em"><div style="font-size:.5em;letter-spacing:.2em;text-transform:uppercase;color:${w.color};text-shadow:0 0 18px ${w.color}88,0 2px 4px rgba(0,0,0,.8)">Denied</div><div style="font:italic 500 .25em Inter,sans-serif;letter-spacing:.03em;color:#e6e2f5;text-shadow:0 2px 4px rgba(0,0,0,.8);margin-top:.15em">${_jabFor(lb)}</div></div>`);
  }
  if (_rv.streakEnded) {
    const l = _rvP(_rv.streakEnded.idx);
    _rvLines.push(`<div style="font:600 .24em Inter,sans-serif;letter-spacing:.06em;color:#e6e2f5;text-shadow:0 2px 4px rgba(0,0,0,.8);margin-top:.35em">Streak ended · <span style="color:${l.color}">${l.name}</span>'s run stops at ${_rv.streakEnded.n}</div>`);
  }
  if (_rv.streak && _rv.streak.n >= 3) {
    const w = _rvP(_rv.streak.idx), big = _rv.streak.n >= 5;
    _rvLines.push(`<div style="font:${big ? '700 .28em Cinzel,serif' : '600 .24em Inter,sans-serif'};letter-spacing:${big ? '.1em' : '.06em'};${big ? 'text-transform:uppercase;' : ''}color:${big ? '#ffb347' : '#e6e2f5'};text-shadow:${big ? '0 0 16px #ff8a1f99,' : ''}0 2px 4px rgba(0,0,0,.8);margin-top:.35em">🔥 ${big ? `Unstoppable · <span style="color:${w.color}">${w.name}</span> · ${_rv.streak.n} in a row` : `<span style="color:${w.color}">${w.name}</span> is on a streak · ${_rv.streak.n} wins`}</div>`);
  }
  const _rvHtml = _rvLines.slice(0, 2).join('');
  const _grudgeFight = !!(_rv.revenge || _rv.denied);
  const S = BATTLE_STAGE, ring = S.mode === 'ring';
  const effLabel = lb.attM && lb.defM ? (TYPE_STRONG[lb.attM.type]===lb.defM.type ? '2× Strong!' : TYPE_WEAK[lb.attM.type]===lb.defM.type ? '½× Weak' : '') : '';

  // v0.6.88: staging from BATTLE_STAGE
  const _pos = attPlayer ? attPlayer.position : null, _tile = (_pos != null && G && G.board) ? G.board[_pos] : null;
  const _plate = (ring && S.tilePlate && _tile) ? `<div style="font-size:10px;color:var(--text-dim);margin-top:10px;letter-spacing:.08em;">Tile ${_pos}${_tile.element ? ` · <span style="color:${TYPE_COLOR[_tile.element] || 'var(--text-dim)'}">${_tile.element}</span>` : ''}</div>` : '';
  overlay.style.background = ring ? 'none' : `rgba(8,8,20,${S.dim})`;
  overlay.innerHTML = `
    ${ring ? `<div id="bsDim" style="position:absolute;inset:0;background:rgba(8,8,20,${S.dim});"></div>
    <div id="bsDisc" style="position:absolute;left:50%;top:50%;width:${S.discSize}px;height:${S.discSize}px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(10,11,22,${S.discAlpha});border:2px solid #5d5294;box-shadow:0 0 40px rgba(93,82,148,.3);"></div>` : ''}
    <div id="bsStage" style="position:relative;display:flex;flex-direction:column;align-items:center;">
    <div style="font-size:${S.titleSize}px;letter-spacing:.25em;text-transform:uppercase;color:var(--accent-pale);font-family:'Cinzel',serif;margin-bottom:18px;">⚔ ${_grudgeFight ? 'Grudge Match' : 'Battle'}</div>
    <div id="baArena" style="display:flex;align-items:center;gap:${S.gap}px;position:relative;">
      <div id="baAttSide" style="display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;">
        <div style="font-size:${S.nameSize}px;letter-spacing:.14em;text-transform:uppercase;font-family:'Cinzel',serif;color:${attPlayer?.color||'var(--accent-lit)'};">${attPlayer?.name||'Attacker'}</div>
        <div id="baAttCard" style="display:inline-block;position:relative;"><div style="zoom:${S.cardScale}">${renderBoardCard(lb.attM, lb.attM.hp + lb.defDmg)}</div></div>
        <div id="baAttFx" class="bfx-col"${_bsFxStyle('att', ring)}></div>
        <div id="baAttDmg" style="position:absolute;top:14px;left:50%;font-size:${S.dmgSize}px;font-weight:900;font-family:'Cinzel',serif;color:#e84040;pointer-events:none;text-shadow:0 0 12px #e8404088;white-space:nowrap;opacity:0;transform:translateX(-50%);">-${lb.defDmg}</div>
      </div>
      <div id="baMid" style="display:flex;flex-direction:column;align-items:center;gap:10px;min-width:54px;">
        ${effLabel ? `<div style="font-size:${S.effSize}px;color:var(--text-lo);font-family:'Cinzel',serif;letter-spacing:.06em;text-align:center;">${effLabel}</div>` : ''}
      </div>
      <div id="baDefSide" style="display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;">
        <div style="font-size:${S.nameSize}px;letter-spacing:.14em;text-transform:uppercase;font-family:'Cinzel',serif;color:${defPlayer?.color||'var(--text-dim)'};">${defPlayer?.name||'Defender'}</div>
        <div id="baDefCard" style="display:inline-block;position:relative;"><div style="zoom:${S.cardScale}">${renderBoardCard(lb.defM, lb.defM.hp + lb.atkDmg)}</div></div>
        <div id="baDefFx" class="bfx-col"${_bsFxStyle('def', ring)}></div>
        <div id="baDefDmg" style="position:absolute;top:14px;left:50%;font-size:${S.dmgSize}px;font-weight:900;font-family:'Cinzel',serif;color:#e84040;pointer-events:none;text-shadow:0 0 12px #e8404088;white-space:nowrap;opacity:0;transform:translateX(-50%);">-${lb.atkDmg}</div>
      </div>
    </div>
    ${_plate}
    <div id="baOutcome" style="opacity:0;font-family:'Cinzel',serif;font-size:${S.outcomeSize}px;font-weight:900;color:${outcomeColor};text-shadow:0 0 28px ${outcomeColor}66;letter-spacing:.05em;margin-top:22px;text-align:center;line-height:1.05;">${outcomeLabel}${_rvHtml}</div>
    <div style="font-size:9px;color:var(--text-mute);margin-top:10px;letter-spacing:.1em;">tap to skip</div>
    </div>`;

  try { if (window._bdFight) _bdFight(overlay, lb); } catch (e) {}   // v0.6.94: battle dice beside the names
  const attCard = overlay.querySelector('#baAttCard');
  const defCard = overlay.querySelector('#baDefCard');
  const attDmg  = overlay.querySelector('#baAttDmg');
  const defDmg  = overlay.querySelector('#baDefDmg');
  const outcomeEl = overlay.querySelector('#baOutcome');
  const attSide = overlay.querySelector('#baAttSide');
  const defSide = overlay.querySelector('#baDefSide');
  const arena   = overlay.querySelector('#baArena');
  // v0.5.03: ability/effect callouts under each card
  const fxList = Array.isArray(lb.effects) ? lb.effects : [];
  const attFxCol = overlay.querySelector('#baAttFx');
  const defFxCol = overlay.querySelector('#baDefFx');
  let fxShown = 0;
  function showFx(e, animate) {
    const col = e.side === 'att' ? attFxCol : defFxCol;
    if (!col) return;
    col.insertAdjacentHTML('beforeend', battleFxRow(e));
    const el = col.lastElementChild;
    if (animate && el) { el.animate([{opacity:0,transform:'translateY(8px) scale(.96)'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'}); (typeof sfxSample === 'function') && sfxSample('callout', { gap: 200, vol: 0.8 }); }   // v0.6.92
  }
  function showAllFx() { while (fxShown < fxList.length) showFx(fxList[fxShown++], false); }

  let skipped = false;
  function showFinal() {
    skipped = true;
    if (S.impact) { try { [attCard, defCard, attFxCol, defFxCol].forEach(c => c && c.getAnimations().forEach(a => a.cancel())); } catch (e) {} }   // v0.6.89: drop held poses (v0.6.97: and moved callouts)
    if (attCrumbles) attCard.style.opacity = '0';
    if (defCrumbles) defCard.style.opacity = '0';
    if (isStalemate) {
      [attCard,defCard].forEach(c=>{ c.style.boxShadow='0 0 0 3px #c9922a88'; c.style.borderRadius='10px'; });
    }
    attDmg.style.opacity = '0';
    defDmg.style.opacity = '0';
    outcomeEl.style.opacity = '1';
    try { if (window._bdStrike) _bdStrike(overlay, 'all'); } catch (e) {}   // v0.6.99
    showAllFx();
    if (typeof _battleReveal === 'function') _battleReveal();   // v0.6.86: tap-to-skip releases the side panel too
  }
  overlay.addEventListener('click', showFinal);

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function shock(color) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:50%;left:50%;width:110px;height:110px;border-radius:50%;border:5px solid ${color};pointer-events:none;`;
    arena.appendChild(el);
    el.animate([
      {transform:'translate(-50%,-50%) scale(.1)',opacity:.85,borderWidth:'6px'},
      {transform:'translate(-50%,-50%) scale(3.4)',opacity:0,borderWidth:'1px'}
    ],{duration:500,easing:'ease-out',fill:'forwards'}).finished.then(()=>el.remove());
  }
  function shake(el, dir=1) {
    _bsShake(el === attCard ? lb.defDmg : lb.atkDmg);   // v0.6.89: the whole screen jolts with the card that was hit
    el.animate([
      {transform:'translateX(0)'},
      {transform:`translateX(${-9*dir}px) rotate(${-2.5*dir}deg)`},
      {transform:`translateX(${7*dir}px) rotate(${1.5*dir}deg)`},
      {transform:`translateX(${-5*dir}px)`},
      {transform:`translateX(${3*dir}px)`},
      {transform:'translateX(0)'}
    ],{duration:430,easing:'ease'});
  }
  function floatDmg(el) {
    el.style.opacity = '1';
    el.animate([
      {opacity:0,transform:'translateX(-50%) translateY(0) scale(.6)'},
      {opacity:1,transform:'translateX(-50%) translateY(-10px) scale(1.2)',offset:.15},
      {opacity:1,transform:'translateX(-50%) translateY(-34px) scale(1)',offset:.72},
      {opacity:0,transform:'translateX(-50%) translateY(-48px) scale(.85)'}
    ],{duration:920,easing:'ease',fill:'forwards'}).finished.then(()=>{ el.style.opacity='0'; });
  }

  // v0.6.88 (ring): leave the contested tile lit — a soft hole in the dim over that tile
  if (ring && S.tileSpot && _pos != null) {
    try {
      const te = typeof _fxTile === 'function' ? _fxTile(_pos) : null, dimEl = overlay.querySelector('#bsDim');
      if (te && dimEl) {
        const o = overlay.getBoundingClientRect(), r = te.getBoundingClientRect(), k = (o.width / overlay.offsetWidth) || 1;
        const x = Math.round((r.left + r.width / 2 - o.left) / k), y = Math.round((r.top + r.height / 2 - o.top) / k), R = S.spotRadius;
        const m = `radial-gradient(circle ${R}px at ${x}px ${y}px, transparent 0, transparent ${Math.round(R * .62)}px, #000 ${R}px)`;
        dimEl.style.webkitMaskImage = m; dimEl.style.maskImage = m;
      }
    } catch (e) {}
  }

  // Beat 1 — the fighters arrive
  // v0.6.88 (ring + handoff): they start where the preview cards were and grow into place; otherwise they slide in
  let _handed = false;
  if (ring && S.handoff && _bsPrev && Date.now() - _bsPrev.t < 4000) {
    try {
      const k = (overlay.getBoundingClientRect().width / overlay.offsetWidth) || 1;
      [[attCard, _bsPrev.att], [defCard, _bsPrev.def]].forEach(([el, from]) => {
        const to = el.getBoundingClientRect();
        if (!to.width || !from.width) throw 0;
        const s = from.width / to.width, dx = (from.left - to.left) / k, dy = (from.top - to.top) / k;
        el.style.transformOrigin = '0 0';
        el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})` }, { transform: 'translate(0,0) scale(1)' }], { duration: S.handoffMs, easing: 'cubic-bezier(.2,.8,.3,1)' })
          .finished.then(() => { el.style.transformOrigin = ''; }).catch(() => {});
      });
      overlay.querySelector('#bsStage').animate([{ opacity: .35 }, { opacity: 1 }], { duration: Math.min(220, S.handoffMs) });
      _handed = true;
    } catch (e) { _handed = false; }
  }
  _bsPrev = null;
  if (!_handed) {
    attSide.animate([{transform:'translateX(-60px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:340,easing:'ease',fill:'both'});
    defSide.animate([{transform:'translateX(60px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:340,easing:'ease',fill:'both'});
  }

  await wait(_handed ? Math.max(380, S.handoffMs + 40) : 380); if (skipped) return;
  if (window._bsFreeze) { if (window._bsFreezeFx) { try { if (window._bdStrike) _bdStrike(overlay, 'all'); } catch (e) {} showAllFx(); } return; }   // v0.6.99: dice callouts too   // Battle Lab still: fighters in place, no strikes (v0.6.97: callouts shown if asked)

  // ─── v0.6.89: stage 3 hit choreography (BATTLE_STAGE.impact) ─────────────────────────────────────────────────
  // wind-up → strike → freeze on contact → knock-back + screen jolt + damage number + HP drain → (counter) →
  // death by element / winner steps up → outcome. Reduced effects keeps the plain beats below.
  let _reduced = false;
  try { _reduced = (window.BoardFX && BoardFX.level === 'reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (S.impact && !_reduced) {
    const TS = S.timeScale > 0 ? S.timeScale : 1, T = ms => Math.max(1, ms * TS), W = ms => wait(T(ms));
    const k = (overlay.getBoundingClientRect().width / overlay.offsetWidth) || 1;
    const A = { card: attCard, dmgEl: attDmg, m: lb.attM, dir: 1,  col: (attPlayer && attPlayer.color) || '#ffb43c' };
    const D = { card: defCard, dmgEl: defDmg, m: lb.defM, dir: -1, col: (defPlayer && defPlayer.color) || '#648cff' };
    const strikes = stormtalonDefending ? [[D, A, lb.defDmg], [A, D, lb.atkDmg]] : [[A, D, lb.atkDmg], [D, A, lb.defDmg]];
    const hitF = d => S.lungeByDamage ? Math.max(.6, Math.min(1.7, d / 28)) : 1;
    const numF = d => S.dmgByDamage ? Math.max(.7, Math.min(1.6, .7 + d / 50)) : 1;

    function drainHp(c, newHp) {
      const fill = c.card.querySelector('.mc-hp-fill'), track = c.card.querySelector('.mc-hp-track'), num = c.card.querySelector('.mc-hp-num');
      const hp = Math.max(0, newHp), pct = Math.max(0, Math.min(1, hp / c.m.maxHp)), dur = T(S.hpDrainMs);
      if (fill && track) {
        const from = fill.style.width;
        if (S.hpGhost) {
          track.style.position = 'relative'; fill.style.position = 'relative';
          const g = document.createElement('div');
          g.style.cssText = `position:absolute;left:0;top:0;height:100%;width:${from};background:#fff;opacity:.6;border-radius:2px;transition:width ${dur}ms cubic-bezier(.5,0,.3,1) ${T(160)}ms;`;
          track.insertBefore(g, fill);
          fill.style.transition = `width ${Math.round(dur * .35)}ms ease-out`;
          requestAnimationFrame(() => { g.style.width = Math.round(pct * 100) + '%'; });
          setTimeout(() => g.remove(), dur + T(260));
        } else fill.style.transition = `width ${dur}ms cubic-bezier(.3,.7,.3,1)`;
        fill.style.width = Math.round(pct * 100) + '%';
        if (pct < .35) fill.style.background = '#b05050';
      }
      if (num) {
        const start = parseInt(num.textContent, 10), t0 = performance.now();
        const step = t => { const f = Math.min(1, (t - t0) / dur); if (!num.isConnected) return; num.textContent = Math.round((isNaN(start) ? hp : start) + (hp - (isNaN(start) ? hp : start)) * f) + '/' + c.m.maxHp; if (f < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }
    }
    function popDamage(c, dmg) {
      const el = c.dmgEl; if (!el) return;
      el.style.top = '36%'; el.style.zIndex = '6'; el.style.fontSize = Math.round(S.dmgSize * numF(dmg)) + 'px'; el.style.opacity = '1';
      el.animate([
        { opacity: 0, transform: 'translateX(-50%) translateY(0) scale(2.3)' },
        { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(.92)', offset: .12 },
        { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)', offset: .2 },
        { opacity: 1, transform: 'translateX(-50%) translateY(-10px) scale(1)', offset: .78 },
        { opacity: 0, transform: 'translateX(-50%) translateY(-34px) scale(.9)' }
      ], { duration: T(S.dmgHoldMs), easing: 'ease-out', fill: 'forwards' }).finished.then(() => { el.style.opacity = '0'; }).catch(() => {});
    }
    function stampType(from, to) {
      if (!S.stamp || !from.m.type || !to.m.type) return;
      const strong = TYPE_STRONG[from.m.type] === to.m.type, weak = TYPE_WEAK[from.m.type] === to.m.type;
      if (!strong && !weak) return;
      const d = document.createElement('div');
      d.textContent = strong ? '2× STRONG' : 'RESISTED';
      d.style.cssText = `position:absolute;left:50%;top:66%;z-index:7;pointer-events:none;white-space:nowrap;font-family:'Cinzel',serif;font-weight:900;font-size:${S.stampSize}px;letter-spacing:.08em;`
        + `color:${strong ? '#ffd77a' : '#aab0c4'};border:2px solid ${strong ? '#ffd77a' : '#aab0c4'};border-radius:6px;padding:2px 8px;background:rgba(10,10,22,.78);text-shadow:0 0 12px ${strong ? '#ffb43c' : '#667'};`;
      to.card.appendChild(d);
      setTimeout(() => { if (!skipped) (typeof sfxSample === 'function') && sfxSample('stamp'); }, T(150));   // v0.6.92: as the stamp slaps down
      d.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) rotate(-9deg) scale(2.6)' },
        { opacity: 1, transform: 'translate(-50%,-50%) rotate(-9deg) scale(.94)', offset: .16 },
        { opacity: 1, transform: 'translate(-50%,-50%) rotate(-9deg) scale(1)', offset: .24 },
        { opacity: 1, transform: 'translate(-50%,-50%) rotate(-9deg) scale(1)', offset: .8 },
        { opacity: 0, transform: 'translate(-50%,-50%) rotate(-9deg) scale(1.05)' }
      ], { duration: T(1150), easing: 'ease-out', fill: 'forwards' }).finished.then(() => d.remove()).catch(() => d.remove());
    }
    async function strike(from, to, dmg, toHpAfter) {
      const dir = from.dir, f = hitF(dmg), L = S.lungePx * f;
      const total = S.windupMs + S.lungeMs + S.hitStopMs + S.recoverMs;
      const o1 = S.windupMs / total, o2 = (S.windupMs + S.lungeMs) / total, o3 = (S.windupMs + S.lungeMs + S.hitStopMs) / total;
      from.card.style.zIndex = '4'; to.card.style.zIndex = '3';
      setTimeout(() => { if (!skipped) (typeof sfxSample === 'function') && sfxSample('lunge'); }, T(Math.max(0, S.windupMs - 40)));   // v0.6.92: whoosh as the lunge starts
      from.card.animate([
        { transform: 'translateX(0px) scale(1) rotate(0deg)', easing: 'cubic-bezier(.3,0,.2,1)' },
        { transform: `translateX(${-dir * S.windupPx}px) scale(.96) rotate(${-dir * 2}deg)`, offset: o1, easing: 'cubic-bezier(.7,0,.95,.55)' },
        { transform: `translateX(${dir * L}px) scale(1.08) rotate(${dir * 3}deg)`, offset: o2, easing: 'linear' },
        { transform: `translateX(${dir * L}px) scale(1.08) rotate(${dir * 3}deg)`, offset: o3, easing: 'cubic-bezier(.2,.8,.3,1)' },
        { transform: 'translateX(0px) scale(1) rotate(0deg)' }
      ], { duration: T(total) });
      await W(S.windupMs + S.lungeMs); if (skipped) return;
      // contact: everything holds for hitStopMs
      shock(from === A ? 'rgba(255,180,60,.75)' : 'rgba(100,140,255,.75)');
      playCardHitAnim(to.card, getHitAnim(from.m));
      if (f >= 1.25) (typeof sfxSample === 'function') && sfxSample('hitHeavy', { gap: 600 });   // v0.6.92: heavy layer on big hits (35+ damage)
      if (S.flash) to.card.animate([{ filter: 'brightness(3.2) saturate(0)' }, { filter: 'brightness(3.2) saturate(0)', offset: Math.min(.6, S.hitStopMs / (S.hitStopMs + 160)) }, { filter: 'brightness(1) saturate(1)' }], { duration: T(S.hitStopMs + 160), easing: 'ease-out' });
      stampType(from, to);
      await W(S.hitStopMs); if (skipped) return;
      // release: knock-back, screen jolt, number, HP
      const kb = S.cardShakePx * f;
      to.card.animate([
        { transform: 'translateX(0px) rotate(0deg)' },
        { transform: `translateX(${dir * kb * 1.7}px) rotate(${dir * 3.5}deg)`, offset: .14 },
        { transform: `translateX(${-dir * kb}px) rotate(${-dir * 2}deg)`, offset: .36 },
        { transform: `translateX(${dir * kb * .55}px) rotate(${dir * 1}deg)`, offset: .58 },
        { transform: `translateX(${-dir * kb * .25}px) rotate(0deg)`, offset: .8 },
        { transform: 'translateX(0px) rotate(0deg)' }
      ], { duration: T(460), easing: 'ease-out' });
      _bsShake(dmg);
      popDamage(to, dmg);
      drainHp(to, toHpAfter);
      await W(S.recoverMs);
    }
    function die(c) {
      (typeof sfxSample === 'function') && sfxSample('death', { gap: 250 });   // v0.6.92
      const el = c.card, dur = T(S.deathMs), col = TYPE_COLOR[c.m.type] || '#9397ab', away = -c.dir;
      const type = S.deathStyle === 'element' ? (c.m.type || '') : '';
      try {
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (window.BoardFX && BoardFX.ring && BoardFX.sparks) {
          BoardFX.ring(cx, cy, 80 * k, col, { dur: T(650), delay: T(type === 'Arcane' ? 140 : 60) });
          BoardFX.sparks(cx, cy, type === 'Arcane' ? '#ffffff' : col, type === 'Arcane' ? 26 : 14, (type === 'Arcane' ? 150 : 100) * k, { dur: T(800), delay: T(type === 'Arcane' ? 150 : 80) });
        }
      } catch (e) {}
      let kf, ease = 'ease-in';
      if (type === 'Undead') kf = [      // dissolves upward
        { opacity: 1, filter: 'blur(0px) saturate(1) brightness(1)', transform: 'translateY(0px) scale(1)' },
        { opacity: .9, filter: 'blur(1px) saturate(.3) brightness(1.35)', transform: 'translateY(-4px) scale(1.01)', offset: .25 },
        { opacity: 0, filter: 'blur(10px) saturate(0) brightness(1.7)', transform: 'translateY(-38px) scale(1.07)' }];
      else if (type === 'Nature') { el.style.transformOrigin = '50% 100%'; kf = [   // wilts
        { opacity: 1, filter: 'sepia(0) brightness(1)', transform: 'rotate(0deg) scaleY(1) translateY(0px)' },
        { opacity: 1, filter: 'sepia(.7) brightness(.8)', transform: `rotate(${away * 6}deg) scaleY(.95) translateY(0px)`, offset: .35 },
        { opacity: .75, filter: 'sepia(1) brightness(.45)', transform: `rotate(${away * 15}deg) scaleY(.55) translateY(6px)`, offset: .8 },
        { opacity: 0, filter: 'sepia(1) brightness(.3)', transform: `rotate(${away * 19}deg) scaleY(.3) translateY(12px)` }]; }
      else if (type === 'Arcane') { ease = 'linear'; kf = [   // charges, then shatters
        { opacity: 1, filter: 'brightness(1) blur(0px)', transform: 'scale(1)' },
        { opacity: 1, filter: 'brightness(2.8) blur(0px)', transform: 'scale(1.05)', offset: .16 },
        { opacity: 1, filter: 'brightness(1.3) blur(0px)', transform: 'scale(.97)', offset: .3 },
        { opacity: 0, filter: 'brightness(2.4) blur(4px)', transform: 'scale(1.4)', offset: .62 },
        { opacity: 0, filter: 'brightness(2.4) blur(4px)', transform: 'scale(1.4)' }]; }
      else if (type === 'Dark') kf = [    // collapses into itself
        { opacity: 1, filter: 'brightness(1)', transform: 'scale(1) rotate(0deg)' },
        { opacity: 1, filter: 'brightness(.7)', transform: 'scale(1.05) rotate(-2deg)', offset: .2 },
        { opacity: .95, filter: 'brightness(0)', transform: 'scale(.14) rotate(38deg)', offset: .86 },
        { opacity: 0, filter: 'brightness(0)', transform: 'scale(0) rotate(55deg)' }];
      else if (type === 'Light') kf = [   // burns out upward
        { opacity: 1, filter: 'brightness(1) saturate(1)', transform: 'translateY(0px) scaleX(1) scaleY(1)' },
        { opacity: 1, filter: 'brightness(1.9) saturate(.8)', transform: 'translateY(0px) scaleX(1.03) scaleY(1.03)', offset: .25 },
        { opacity: 0, filter: 'brightness(4.5) saturate(.2)', transform: 'translateY(-50px) scaleX(.45) scaleY(1.3)' }];
      else if (type === 'Beast') kf = [   // knocked off its feet
        { opacity: 1, filter: 'brightness(1)', transform: 'translate(0px,0px) rotate(0deg)' },
        { opacity: 1, filter: 'brightness(1)', transform: `translate(${away * 14}px,-12px) rotate(${away * 8}deg)`, offset: .25 },
        { opacity: 0, filter: 'brightness(.5)', transform: `translate(${away * 48}px,74px) rotate(${away * 40}deg)` }];
      else { ease = 'ease'; kf = [         // the plain crumble (also Support cards)
        { transform: 'scale(1) rotate(0deg) translateY(0px)', opacity: 1, filter: 'saturate(1) brightness(1)' },
        { transform: 'scale(1.04) rotate(-3deg) translateY(0px)', opacity: 1, filter: 'saturate(.25) brightness(1)', offset: .22 },
        { transform: 'scale(.82) rotate(9deg) translateY(14px)', opacity: .55, filter: 'saturate(0) brightness(.55)', offset: .62 },
        { transform: 'scale(.38) rotate(20deg) translateY(32px)', opacity: 0, filter: 'saturate(0) brightness(.2)' }]; }
      el.animate(kf, { duration: dur, easing: ease, fill: 'forwards' });
    }
    function celebrate(c) {
      if (!S.winnerPulse) return;
      const el = c.card; el.style.zIndex = '5';
      try { const mid = overlay.querySelector('#baMid'); if (mid && S.winnerCenter) mid.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(180), fill: 'forwards' }); } catch (e) {}
      let dx = 0;
      if (S.winnerCenter) { try { const r = el.getBoundingClientRect(), a = arena.getBoundingClientRect(); dx = ((a.left + a.width / 2) - (r.left + r.width / 2)) / k; } catch (e) {} }
      el.animate([
        { transform: 'translateX(0px) scale(1)', filter: `drop-shadow(0 0 0px ${c.col})` },
        { transform: `translateX(${dx * .8}px) scale(${S.winnerScale + .05})`, filter: `drop-shadow(0 0 26px ${c.col})`, offset: .6 },
        { transform: `translateX(${dx}px) scale(${S.winnerScale})`, filter: `drop-shadow(0 0 12px ${c.col})` }
      ], { duration: T(S.winnerMs), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      // v0.6.97: side callouts travel with the winner (and stay clear of the card as it grows)
      const col = el === attCard ? attFxCol : el === defCard ? defFxCol : null;
      if (col && S.fxPlace === 'side' && S.fxFollow && (dx || S.winnerScale !== 1)) {
        const grow = (S.winnerScale - 1) * el.offsetWidth / 2, ox = dx + (el === attCard ? -grow : grow);
        const base = S.fxAlign === 'middle' ? ' translateY(-50%)' : '';
        col.animate([{ transform: `translateX(0px)${base}` }, { transform: `translateX(${ox}px)${base}` }],
                    { duration: T(S.winnerMs), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      }
    }

    // the strikes: each side is hit at most once, so the HP after a strike is that fighter's final HP
    let n = 0;
    for (const [from, to, dmg] of strikes) {
      if (!(dmg > 0)) continue;
      if (n === 1 && from.m.hp <= 0 && !stormtalonDefending && lb.outcome !== 'mutual') continue;
      if (n++) { await W(S.betweenMs); if (skipped) return; }
      try { if (window._bdStrike) _bdStrike(overlay, from === A ? 'att' : 'def'); } catch (e) {}   // v0.6.99: dice callouts light up with the strike they affect
      await strike(from, to, dmg, to.m.hp); if (skipped) return;
    }
    try { if (window._bdStrike) _bdStrike(overlay, 'all'); } catch (e) {}   // v0.6.99: dice that never struck (no counter) still show
    await W(Math.round(S.betweenMs * .6)); if (skipped) return;
    if (isStalemate) {
      [attCard, defCard].forEach(c => c.animate([
        { boxShadow: '0 0 0 0 rgba(201,146,42,0)', borderRadius: '10px' }, { boxShadow: '0 0 0 9px rgba(201,146,42,.55)', borderRadius: '10px' },
        { boxShadow: '0 0 0 5px rgba(201,146,42,.22)', borderRadius: '10px' }, { boxShadow: '0 0 0 3px rgba(201,146,42,.18)', borderRadius: '10px' }
      ], { duration: T(620), easing: 'ease', fill: 'forwards' }));
      await W(450);
    } else {
      if (attCrumbles) die(A);
      if (defCrumbles) die(D);
      await W(Math.round(S.deathMs * .55)); if (skipped) return;
      if (!attCrumbles) celebrate(A); else if (!defCrumbles) celebrate(D);
      await W(Math.max(Math.round(S.deathMs * .3), (attCrumbles && defCrumbles) ? 0 : Math.round(S.winnerMs * .7)));
    }
    if (skipped) return;
    await W(S.outcomeDelayMs); if (skipped) return;
    if (typeof _battleReveal === 'function') _battleReveal();
    outcomeEl.style.opacity = '1';
    outcomeEl.animate([{ opacity: 0, transform: 'scale(.48)' }, { opacity: 1, transform: 'scale(1.14)', offset: .58 }, { opacity: 1, transform: 'scale(.95)', offset: .82 }, { opacity: 1, transform: 'scale(1)' }], { duration: T(460), easing: 'ease', fill: 'both' });
    await W(250);
    while (fxShown < fxList.length) { if (skipped) return; showFx(fxList[fxShown++], true); await W(400); }
    return;
  }

  try { if (window._bdStrike) _bdStrike(overlay, 'all'); } catch (e) {}   // v0.6.99: plain strikes (Reduced effects): dice callouts all at once
  // Beat 2 — first strike (Stormtalon defending = defender strikes first; else attacker strikes)
  if (stormtalonDefending) {
    // Stormtalon pre-emptive: DEFENDER lunges at attacker
    defCard.animate([
      {transform:'translateX(0) scale(1)'},
      {transform:'translateX(-44px) scale(1.07)',offset:.38},
      {transform:'translateX(0) scale(1)'}
    ],{duration:330,easing:'ease'});
    shock('rgba(100,140,255,.75)');
    setTimeout(()=>{ if (!skipped){ shake(attCard,1); floatDmg(attDmg); playCardHitAnim(attCard, getHitAnim(lb.defM)); } },130);
    // HP bar: attacker takes damage from Stormtalon's pre-emptive (defDmg)
    setTimeout(()=>{ if (!skipped) animateHpBar(attCard, lb.attM, lb.attM.hp); }, 320);
  } else {
    // Normal: ATTACKER lunges at defender
    attCard.animate([
      {transform:'translateX(0) scale(1)'},
      {transform:'translateX(44px) scale(1.07)',offset:.38},
      {transform:'translateX(0) scale(1)'}
    ],{duration:330,easing:'ease'});
    shock('rgba(255,180,60,.75)');
    setTimeout(()=>{ if (!skipped){ shake(defCard,-1); floatDmg(defDmg); playCardHitAnim(defCard, getHitAnim(lb.attM)); } },130);
    // HP bar: defender takes atkDmg — if counter exists it survives to hasCounter HP, else final HP
    const defHpAfterBeat2 = hasCounter ? lb.defM.hp : lb.defM.hp;
    setTimeout(()=>{ if (!skipped) animateHpBar(defCard, lb.defM, defHpAfterBeat2); }, 320);
  }

  await wait(hasCounter ? 390 : 330); if (skipped) return;

  // Beat 3 — counter-strike (if the first-struck survived)
  if (hasCounter) {
    if (stormtalonDefending) {
      // Attacker counter (if they survived Stormtalon's pre-emptive)
      attCard.animate([
        {transform:'translateX(0) scale(1)'},
        {transform:'translateX(44px) scale(1.07)',offset:.38},
        {transform:'translateX(0) scale(1)'}
      ],{duration:330,easing:'ease'});
      shock('rgba(255,180,60,.75)');
      setTimeout(()=>{ if (!skipped){ shake(defCard,-1); floatDmg(defDmg); playCardHitAnim(defCard, getHitAnim(lb.attM)); } },130);
      setTimeout(()=>{ if (!skipped) animateHpBar(defCard, lb.defM, lb.defM.hp); }, 320);
    } else {
      // Normal: defender counter — attacker takes defDmg
      defCard.animate([
        {transform:'translateX(0) scale(1)'},
        {transform:'translateX(-44px) scale(1.07)',offset:.38},
        {transform:'translateX(0) scale(1)'}
      ],{duration:330,easing:'ease'});
      shock('rgba(100,140,255,.75)');
      setTimeout(()=>{ if (!skipped){ shake(attCard,1); floatDmg(attDmg); playCardHitAnim(attCard, getHitAnim(lb.defM)); } },130);
      setTimeout(()=>{ if (!skipped) animateHpBar(attCard, lb.attM, lb.attM.hp); }, 320);
    }
    await wait(390); if (skipped) return;
  }

  // Beat 4 — crumble or gold pulse
  const crumbleKf = [
    {transform:'scale(1) rotate(0deg)',opacity:1,filter:'saturate(1)'},
    {transform:'scale(1.04) rotate(-3deg)',opacity:1,filter:'saturate(.25)',offset:.22},
    {transform:'scale(.82) rotate(9deg) translateY(14px)',opacity:.55,filter:'saturate(0) brightness(.55)',offset:.62},
    {transform:'scale(.38) rotate(20deg) translateY(32px)',opacity:0,filter:'saturate(0) brightness(.2)'}
  ];
  if (isStalemate) {
    [attCard,defCard].forEach(c=>c.animate([
      {boxShadow:'0 0 0 0 rgba(201,146,42,0)',borderRadius:'10px'},
      {boxShadow:'0 0 0 9px rgba(201,146,42,.55)',borderRadius:'10px'},
      {boxShadow:'0 0 0 5px rgba(201,146,42,.22)',borderRadius:'10px'},
      {boxShadow:'0 0 0 7px rgba(201,146,42,.38)',borderRadius:'10px'},
      {boxShadow:'0 0 0 3px rgba(201,146,42,.18)',borderRadius:'10px'}
    ],{duration:620,easing:'ease',fill:'forwards'}));
  } else {
    if (attCrumbles) attCard.animate(crumbleKf,{duration:560,easing:'ease',fill:'forwards'});
    if (defCrumbles) defCard.animate(crumbleKf,{duration:560,easing:'ease',fill:'forwards'});
  }

  await wait(510); if (skipped) return;

  // Beat 5 — outcome text
  if (typeof _battleReveal === 'function') _battleReveal();   // v0.6.86: now the chips, crown and Mana floats may show the result
  outcomeEl.style.opacity = '1';
  outcomeEl.animate([
    {opacity:0,transform:'scale(.48)'},
    {opacity:1,transform:'scale(1.14)',offset:.58},
    {opacity:1,transform:'scale(.95)',offset:.82},
    {opacity:1,transform:'scale(1)'}
  ],{duration:460,easing:'ease',fill:'both'});

  // Beat 6 — effect callouts, one at a time in the order they happened
  await wait(250);
  while (fxShown < fxList.length) {
    if (skipped) return;
    showFx(fxList[fxShown++], true);
    await wait(400);
  }
}

// ─── v0.5.03: tile flash for ability-driven element changes ──────────────────
// (Chaos Flux, Thorn Burst, Radiant Strike, Necrotic Claim). Server sends
// G.tileFlashes [{id,pos,from,to,label}]; each new id flashes once, after any
// battle overlay has closed. On first load we only record the latest id.
let _flashSeen = null;
function processTileFlashes() {
  const fl = (G && G.tileFlashes) || [];
  const maxId = fl.reduce((m, f) => Math.max(m, f.id), 0);
  if (_flashSeen === null) { _flashSeen = maxId; return; }
  if (G.phase === 'resolve:battle_result') return; // wait until the battle overlay is gone
  const fresh = fl.filter(f => f.id > _flashSeen);
  _flashSeen = Math.max(_flashSeen, maxId);
  fresh.forEach((f, i) => setTimeout(() => flashTile(f), 120 + i * 1400));
}
function flashTile(f) {
  const col = TYPE_COLOR[f.to] || '#9184d9';
  const cached = tileElCache.get(f.pos);
  const inner = cached && cached.el.querySelector('.tile-inner');
  if (inner) {
    inner.animate([
      {boxShadow:`0 0 0 0 ${col}00`, filter:'brightness(1)'},
      {boxShadow:`0 0 0 6px ${col}, 0 0 30px ${col}`, filter:'brightness(1.8)', offset:.2},
      {boxShadow:`0 0 0 2px ${col}88`, filter:'brightness(1.1)', offset:.45},
      {boxShadow:`0 0 0 6px ${col}, 0 0 30px ${col}`, filter:'brightness(1.8)', offset:.7},
      {boxShadow:`0 0 0 0 ${col}00`, filter:'brightness(1)'}
    ], {duration:1300, easing:'ease-in-out'});
  }
  const toast = document.createElement('div');
  toast.className = 'tile-flash-toast';
  toast.style.setProperty('--fl', col);
  toast.textContent = `${f.label} — tile ${f.pos}: ${f.from} → ${f.to}`;
  document.body.appendChild(toast);
  toast.animate([{opacity:0,transform:'translateX(-50%) translateY(-10px)'},{opacity:1,transform:'translateX(-50%)',offset:.12},{opacity:1,transform:'translateX(-50%)',offset:.85},{opacity:0,transform:'translateX(-50%) translateY(-6px)'}],{duration:2600,easing:'ease'}).finished.then(()=>toast.remove());
}

// ─── Round tally animation ────────────────────────────────────────────────────────────────────
let _tallyPlayedFor = null; // G.turnSummary reference we last animated for
let _tallyRunning   = false;

function runRoundTally(tally, boardArea, onDone) {
  if (_tallyRunning) return;
  _tallyRunning = true;

  // Overlay (non-interactive) + skip button (interactive)
  const ov = document.createElement('div');
  ov.id = 'tally-overlay';
  boardArea.appendChild(ov);

  const skipBtn = document.createElement('button');
  skipBtn.className = 'tally-skip-btn';
  skipBtn.textContent = 'Skip ⏭';
  boardArea.appendChild(skipBtn);

  let skipped = false;
  function cleanup() {
    ov.remove();
    skipBtn.remove();
    _tallyRunning = false;
  }
  skipBtn.onclick = () => { skipped = true; cleanup(); onDone(); };

  function playSound(file) {
    const L = _sfxLvl(); if (L <= 0) return;
    try { const a = new Audio('/audio/' + file); a.volume = 0.6 * L; a.play().catch(() => {}); } catch(e) {}
  }

  // getBoundingClientRect() returns screen (post-scale) coords, but overlay children use
  // boardArea's local (pre-scale) coordinate space. Divide by scale to correct.
  const areaRect = boardArea.getBoundingClientRect();
  const scale = boardArea.offsetWidth > 0 ? areaRect.width / boardArea.offsetWidth : 1;

  // Show a floating number/label over a tile; calls cb when animation finishes
  function showBeat(tilePos, text, positive, milestone, cb) {
    const cached = tileElCache.get(tilePos);
    if (!cached) { setTimeout(cb, 0); return; }
    const tileRect = cached.el.getBoundingClientRect();
    const x = (tileRect.left - areaRect.left + tileRect.width  * 0.5) / scale;
    const y = (tileRect.top  - areaRect.top  + tileRect.height * 0.42) / scale;

    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      'transform:translate(-50%,-50%) scale(0.4)',
      "font-family:'Cinzel',serif",
      `font-size:${milestone ? '12px' : '24px'}`,
      'font-weight:700',
      `color:${milestone ? '#c89f50' : positive ? '#58e068' : '#e05252'}`,
      `text-shadow:0 0 14px ${milestone ? '#c89f50aa' : positive ? '#58e068aa' : '#e05252aa'},0 2px 5px rgba(0,0,0,.85)`,
      'pointer-events:none',
      'z-index:26',
      'white-space:nowrap',
      'letter-spacing:.05em',
    ].join(';');
    el.textContent = text;
    ov.appendChild(el);

    const anim = el.animate([
      { transform:'translate(-50%,-50%) scale(0.4)', opacity:0 },
      { transform:'translate(-50%,-50%) scale(1.5)', opacity:1, offset:0.22 },
      { transform:'translate(-50%,-60%) scale(1.2)', opacity:1, offset:0.55 },
      { transform:'translate(-50%,-110%) scale(1.0)', opacity:0 },
    ], { duration: 675, easing:'ease', fill:'both' });
    anim.onfinish = () => { el.remove(); cb(); };
  }

  const BEATS = ['netMana','netAtk','netDef','netHp'];
  const BEAT_SYMBOL = { netMana:'✦', netAtk:' ATK', netDef:' DEF', netHp:' HP' };
  const SND_POS  = 'Positive.mp3';
  const SND_NEG  = 'Negitive.mp3'; // preserve exact filename spelling
  const SND_MILE = 'Milestone.mp3';

  let si = 0;
  function nextSummon() {
    if (skipped || si >= tally.length) { if (!skipped) cleanup(); onDone(); return; }
    const entry = tally[si++];
    runBeats(entry, nextSummon);
  }

  function runBeats(entry, cb) {
    const active = [];
    for (const key of BEATS) {
      const val = entry[key];
      if (val !== 0) active.push({ key, val });
    }
    // Ability breakdown labels — shown as gold milestone-style beats after netMana
    // These explain WHERE the mana total came from (Rune Priestess ×2, Arch Mage +2, etc.)
    for (const bd of (entry.genBreakdown || [])) {
      if (bd.bonus > 0) active.push({ key:'abilityLabel', text:`${bd.label} +${bd.bonus}✦`, positive: true });
    }
    // Spell Wraith drain explanation (separate from netMana which already subtracts it)
    if (entry.spellWraithDrain > 0) {
      active.push({ key:'abilityLabel', text:`⛧ Spell Wraith −${entry.spellWraithDrain}✦`, positive: false });
    }
    for (const ms of (entry.milestones || [])) active.push({ key:'milestone', val:ms });

    let bi = 0;
    function nextBeat() {
      if (skipped || bi >= active.length) { cb(); return; }
      const { key, val, text: preText, positive: prePositive } = active[bi++];

      let text, positive, milestone;
      if (key === 'abilityLabel') {
        // Gold info-label style (same sizing as milestone but positive/negative colours)
        milestone = true;
        positive  = prePositive;
        text      = preText;
        playSound(positive ? SND_MILE : SND_NEG);
      } else if (key === 'milestone') {
        milestone = true; positive = true;
        text = val === 'vine_aura'      ? '🌿 Vine Aura Active'
             : val === 'moss_aura'      ? '🌱 Moss Aura Active'
             : val === 'oak_overgrowth' ? '🌳 Overgrowth!'
             : '✨ Milestone';
        playSound(SND_MILE);
      } else {
        milestone = false;
        positive  = val > 0;
        const sign = val > 0 ? '+' : '';
        text = sign + val + (BEAT_SYMBOL[key] || '');
        playSound(positive ? SND_POS : SND_NEG);
      }
      showBeat(entry.tilePos, text, positive, milestone, nextBeat);
    }
    nextBeat();
  }

  // v0.6.56: all at once. Every summon's result pops over its tile together (small stagger), one sound,
  // about 2 seconds in total however many summons there are. (The old summon-by-summon run is nextSummon above.)
  function showPop(tilePos, main, sub, positive, delay) {
    const cached = tileElCache.get(tilePos);
    if (!cached) return;
    const tileRect = cached.el.getBoundingClientRect();
    const x = (tileRect.left - areaRect.left + tileRect.width  * 0.5) / scale;
    const y = (tileRect.top  - areaRect.top  + tileRect.height * 0.42) / scale;
    const col = positive ? '#58e068' : '#e05252';
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(0.4);text-align:center;pointer-events:none;z-index:26;white-space:nowrap;opacity:0;`;
    el.innerHTML = `<div style="font-family:'Cinzel',serif;font-size:24px;font-weight:700;letter-spacing:.05em;color:${col};text-shadow:0 0 14px ${col}aa,0 2px 5px rgba(0,0,0,.85)">${main}</div>`
      + (sub ? `<div style="font:700 11px Inter,sans-serif;color:#f2e6c8;text-shadow:0 2px 4px rgba(0,0,0,.9);margin-top:1px">${sub}</div>` : '');
    ov.appendChild(el);
    el.animate([
      { transform:'translate(-50%,-50%) scale(0.4)', opacity:0 },
      { transform:'translate(-50%,-50%) scale(1.4)', opacity:1, offset:0.15 },
      { transform:'translate(-50%,-55%) scale(1.15)', opacity:1, offset:0.7 },
      { transform:'translate(-50%,-100%) scale(1.0)', opacity:0 },
    ], { duration: 1500, delay, easing:'ease', fill:'both' }).onfinish = () => el.remove();
  }
  function burst() {
    const items = tally.filter(e => tileElCache.get(e.tilePos));
    let up = 0, down = 0;
    items.forEach((e, i) => {
      const parts = [];
      if (e.netMana) parts.push((e.netMana > 0 ? '+' : '') + e.netMana + '✦');
      if (e.netHp)   parts.push((e.netHp > 0 ? '+' : '') + e.netHp + ' HP');
      if (e.netAtk)  parts.push((e.netAtk > 0 ? '+' : '') + e.netAtk + ' ATK');
      if (e.netDef)  parts.push((e.netDef > 0 ? '+' : '') + e.netDef + ' DEF');
      if (!parts.length) return;
      const pos = (e.netMana || e.netHp || e.netAtk || e.netDef) > 0;
      pos ? up++ : down++;
      showPop(e.tilePos, parts[0], parts.slice(1).join(' · '), pos, i * 45);
    });
    if (up || down) playSound(up >= down ? SND_POS : SND_NEG);
    setTimeout(() => { if (!skipped) { cleanup(); onDone(); } }, items.length * 45 + 1600);
  }

  burst();
}

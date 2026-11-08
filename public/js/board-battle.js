// board-battle.js: split from the inline page script (L2). Loaded in order by board.html; all files share one global scope.
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
  const fill = cardEl.querySelector('.bmc-hp-fill');
  const num  = cardEl.querySelector('.bmc-hp-num');
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

// ─── 5-beat battle animation ────────────────────────────────────────────────────────────────
async function runBattleAnimation(lb, attPlayer, defPlayer, overlay) {
  const stormtalonDefending = lb.defM && lb.defM.id === 'stormtalon';
  const hasCounter = lb.outcome === 'defender_wins' || lb.outcome === 'stalemate' || (stormtalonDefending && lb.atkDmg > 0);
  const attCrumbles = lb.outcome === 'defender_wins' || lb.outcome === 'mutual';
  const defCrumbles = lb.outcome === 'attacker_wins' || lb.outcome === 'mutual';
  const isStalemate = lb.outcome === 'stalemate';
  const outcomeLabel = {attacker_wins:'Victory!',defender_wins:'Defeated!',mutual:'Mutual Destruction!',stalemate:'Stalemate!'}[lb.outcome] || lb.outcome;
  const outcomeColor = {attacker_wins:'#5dc97d',defender_wins:'#e05252',mutual:'#e0b050',stalemate:'#9184d9'}[lb.outcome] || 'var(--accent-lit)';
  const effLabel = lb.attM && lb.defM ? (TYPE_STRONG[lb.attM.type]===lb.defM.type ? '2× Strong!' : TYPE_WEAK[lb.attM.type]===lb.defM.type ? '½× Weak' : '') : '';

  overlay.innerHTML = `
    <div style="font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--accent-pale);font-family:'Cinzel',serif;margin-bottom:18px;">⚔ Battle</div>
    <div id="baArena" style="display:flex;align-items:center;gap:36px;position:relative;">
      <div id="baAttSide" style="display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;">
        <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-family:'Cinzel',serif;color:${attPlayer?.color||'var(--accent-lit)'};">${attPlayer?.name||'Attacker'}</div>
        <div id="baAttCard" style="display:inline-block;position:relative;">${renderBoardCard(lb.attM, lb.attM.hp + lb.defDmg)}</div>
        <div id="baAttFx" class="bfx-col"></div>
        <div id="baAttDmg" style="position:absolute;top:14px;left:50%;font-size:22px;font-weight:900;font-family:'Cinzel',serif;color:#e84040;pointer-events:none;text-shadow:0 0 12px #e8404088;white-space:nowrap;opacity:0;transform:translateX(-50%);">-${lb.defDmg}</div>
      </div>
      <div id="baMid" style="display:flex;flex-direction:column;align-items:center;gap:10px;min-width:54px;">
        ${effLabel ? `<div style="font-size:11px;color:var(--text-lo);font-family:'Cinzel',serif;letter-spacing:.06em;text-align:center;">${effLabel}</div>` : ''}
      </div>
      <div id="baDefSide" style="display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;">
        <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-family:'Cinzel',serif;color:${defPlayer?.color||'var(--text-dim)'};">${defPlayer?.name||'Defender'}</div>
        <div id="baDefCard" style="display:inline-block;position:relative;">${renderBoardCard(lb.defM, lb.defM.hp + lb.atkDmg)}</div>
        <div id="baDefFx" class="bfx-col"></div>
        <div id="baDefDmg" style="position:absolute;top:14px;left:50%;font-size:22px;font-weight:900;font-family:'Cinzel',serif;color:#e84040;pointer-events:none;text-shadow:0 0 12px #e8404088;white-space:nowrap;opacity:0;transform:translateX(-50%);">-${lb.atkDmg}</div>
      </div>
    </div>
    <div id="baOutcome" style="opacity:0;font-family:'Cinzel',serif;font-size:38px;font-weight:900;color:${outcomeColor};text-shadow:0 0 28px ${outcomeColor}66;letter-spacing:.05em;margin-top:22px;">${outcomeLabel}</div>
    <div style="font-size:9px;color:var(--text-mute);margin-top:10px;letter-spacing:.1em;">tap to skip</div>`;

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
    if (animate && el) el.animate([{opacity:0,transform:'translateY(8px) scale(.96)'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'});
  }
  function showAllFx() { while (fxShown < fxList.length) showFx(fxList[fxShown++], false); }

  let skipped = false;
  function showFinal() {
    skipped = true;
    if (attCrumbles) attCard.style.opacity = '0';
    if (defCrumbles) defCard.style.opacity = '0';
    if (isStalemate) {
      [attCard,defCard].forEach(c=>{ c.style.boxShadow='0 0 0 3px #c9922a88'; c.style.borderRadius='10px'; });
    }
    attDmg.style.opacity = '0';
    defDmg.style.opacity = '0';
    outcomeEl.style.opacity = '1';
    showAllFx();
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

  // Beat 1 — slide in
  attSide.animate([{transform:'translateX(-60px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:340,easing:'ease',fill:'both'});
  defSide.animate([{transform:'translateX(60px)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:340,easing:'ease',fill:'both'});

  await wait(380); if (skipped) return;

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

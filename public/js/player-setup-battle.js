// player-setup-battle.js: split from the inline page script (L2). Loaded in order by player.html; all files share one global scope.
// ─── SETUP PHASE ─────────────────────────────────────────────────────────────

function renderSetupInstructions(isMyTurn) {
  updateStatusBar(isMyTurn);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  // Build a real board-accurate demo tile (Light / tile #7)
  const _demoEl   = 'Light';
  const _demoCol  = TYPE_COLOR[_demoEl];                         // '#e0c07a'
  const _demoBg   = `linear-gradient(160deg,color-mix(in srgb,${_demoCol} 62%,#10111e 38%),color-mix(in srgb,${_demoCol} 40%,#0c0d1a 60%))`;
  const _demoBdr  = `1px solid ${_demoCol}cc`;
  const _demoImg  = TILE_IMG[_demoEl];                           // '/img/tiles/tile-light.png'
  const _demoArt  = _demoImg
    ? `<div style="display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;"><img src="${_demoImg}" style="width:100%;height:100%;object-fit:contain;display:block;" alt=""></div>`
    : `<div style="display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;font-size:20px;line-height:1;text-shadow:0 0 8px currentColor;color:#fff;">${TYPE_ICON[_demoEl]||'✦'}</div>`;
  const _demoTile = `<div style="position:relative;display:inline-flex;flex-direction:column;align-items:center;flex-shrink:0;margin-top:20px;">
    <span style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:10px;color:rgba(255,255,255,.85);line-height:1;white-space:nowrap;font-family:'Inter',system-ui,sans-serif;">7</span>
    <div style="width:70px;height:102px;border-radius:6px;border:${_demoBdr};background:${_demoBg};overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:4px 3px 4px;">
      ${_demoArt}
      <span style="font-size:9px;font-weight:500;letter-spacing:.03em;text-transform:uppercase;text-align:center;line-height:1.2;margin-top:3px;color:${_demoCol};">${_demoEl}</span>
    </div>
  </div>`;

  const PANELS = [
    // Panel 0 — How to Play
    `<div class="setup-instr-title">How to Play</div>
     <div class="setup-instr-body">
       <p>This game runs on two screens: the Board View (the big screen everyone watches) and your Player View (what you're looking at now).</p>
       <p>The board shows every tile, who owns what, and where all the action is happening.</p>
       <div class="instr-tile-row">
         ${_demoTile}
         <div class="instr-tile-caption">Every tile has a number. That number is how you target where you want to go.</div>
       </div>
     </div>`,

    // Panel 1 — Setup & Game Play
    `<div class="setup-instr-title">Setup &amp; Game Play</div>
     <div class="setup-instr-body">
       <p>Before the first roll, each player stations up to 3 summons on unclaimed elemental tiles, completely free.</p>
       <p>On your turn, tap an open tile on the board ring, then pick a summon from your hand and tap <b>Claim</b>. A gold glow means that summon gets a home boost on the tile; red means weak ground.</p>
       <p>Once setup is done, you'll roll to move each turn. Landing on a free tile lets you claim it. Landing on an enemy tile picks a fight.</p>
     </div>`,

    // Panel 2 — The Game
    `<div class="setup-instr-title">The Game</div>
     <div class="setup-instr-body">
       <p>You start with <strong>40✦ Mana</strong>. It's both your life force and your currency. It buys summons, heals fighters, and pays to claim tiles.</p>
       <p>If your Mana hits zero, you're <strong>Sanctioned</strong>: no income, but you still get a Sanction turn and can buy your way back once with Redeem. Lose all your tiles and you're out. The last summoner standing wins outright.</p>
       <p>If the round limit runs out, the player with the most tiles takes the crown.</p>
       <p>Tap the <strong>?</strong> button at the top of your screen any time to review the full rules and element matchups.</p>
     </div>`
  ];

  const isLast = _setupPanelIdx === PANELS.length - 1;
  const dots = PANELS.map((_, i) =>
    `<div class="setup-instr-dot${i === _setupPanelIdx ? ' active' : ''}"></div>`
  ).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="setup-instr-wrap">
      <div class="setup-instr-card">
        <div class="setup-instr-dots">${dots}</div>
        ${PANELS[_setupPanelIdx]}
        <button class="setup-instr-btn" onclick="${isLast ? 'dismissSetupInstructions()' : 'nextSetupPanel()'}">
          ${isLast ? "Let's Play" : 'Next'}
        </button>
      </div>
    </div>`;
}

function nextSetupPanel() {
  _setupPanelIdx++;
  render();
}

function dismissSetupInstructions() {
  _setupPanelIdx = 0;
  _setupClaimSeen = true;
  render();
}

function renderSetup() {
  // v0.5.12: ring-based setup — pick an open tile on the ring, then a summon from the hand strip
  updateStatusBar(true);
  const setupTurnKey = `${G.round}-${G.setupRound||1}-${G.setupTurnIdx||0}`;
  playSoundOnce('setupTurn', setupTurnKey, '/audio/Player-turn.mp3');
  // open on an empty tile at the start of each setup turn
  if (_setupClaimTurnKey !== setupTurnKey) {
    _setupClaimTurnKey = setupTurnKey;
    if (!_isFreeTile(_setupCarouselIdx)) _setupCarouselIdx = _nextFreeTile(_setupCarouselIdx, 1);
  }
  const sel = _setupCarouselIdx;
  const free = _isFreeTile(sel);
  const el = G.board[sel] && G.board[sel].element;

  updateHandStrip(true, {
    label: !myHand.length ? 'Your Hand' : free
      ? `Pick a summon for <b>Tile ${sel}</b> · <span style="color:${TYPE_COLOR[el]}">${el}</span>`
      : 'Pick an open tile first',
    tap: 'openSetupClaimDetail',
    opts: (m) => {
      if (!free) return { dim: true };
      const hf = homeField(m, el);
      return { typeAdvantage: hf === 'boost', typeWeak: hf === 'weak' };
    },
  });
  document.getElementById('main-content').classList.remove('no-hand');
  document.body.classList.add('setup-compact');   // v0.5.13: tighter layout so the full ring fits on phones

  document.getElementById('main-content').innerHTML = `
    <div class="wc-wrap">
      <div class="setup-status-line">Round ${G.setupRound || 1} of 3${G.setupTotalTurns > 0 ? ` · Turn ${(G.setupTurnIdx||0)+1}/${G.setupTotalTurns}` : ''}</div>
      <div class="wc-whose" style="padding-bottom:2px"><span style="font-weight:600">Your turn</span><span style="color:var(--text-mute)">&nbsp;— claim a tile for free</span></div>
      ${buildBoardRing(sel, true, true)}
      ${!myHand.length ? '<div style="text-align:center;padding:12px 16px;color:var(--text-mute);font-size:13px;">No summons in hand — you must pass.</div>' : ''}
    </div>`;
  attachBoardRing();

  selectedIid = null;
  _pickerBar(free && myHand.length ? 'Tap a summon below to <b>claim</b>' : 'Tap the ring to pick an open tile',
    `<button class="action-btn secondary" onclick="doSetupPass()">Pass</button>`);
}

function _setupClaimAction(m) {
  const pos = _setupCarouselIdx;
  if (!_isFreeTile(pos)) return { label:'Claim', kind:'claim', disabled:true, reason:'Pick an open tile on the board first' };
  if (m.canUse === false) return { label:`Claim Tile ${pos}`, kind:'claim', disabled:true, reason:`🔒 Locked${m.conditionDesc ? ' — ' + m.conditionDesc : ''}` };
  return { label:`Claim Tile ${pos} · Free`, kind:'claim', run: (mm) => doSetupClaimTile(pos, mm.iid) };
}
// v0.5.44: shared Home / Weak / Neutral ground banner + highlighted card — setup, claim and swap all use it
function _groundBanner(m, el) {
  const hf = homeField(m, el);
  return hf === 'boost'
    ? `<div class="mu-banner strong"><span class="mu-big">▲ HOME BOOST</span><span class="mu-sub">${el} tile · +15% ATK &amp; DEF defending</span></div>`
    : hf === 'weak'
    ? `<div class="mu-banner weak"><span class="mu-big">▼ WEAK GROUND</span><span class="mu-sub">${el} tile · −15% DEF defending</span></div>`
    : `<div class="mu-banner neutral"><span class="mu-big" style="font-size:15px">NEUTRAL GROUND</span><span class="mu-sub">${el || ''} tile · no modifier</span></div>`;
}
function _groundSlide(m, el) {
  const hf = homeField(m, el);
  const body = _cardDetailBody(m).replace(renderCard(m, {size:'full', showCost:true}),
    renderCard(m, {size:'full', showCost:true, typeAdvantage: hf === 'boost', typeWeak: hf === 'weak'}));
  return _groundBanner(m, el) + body;
}
function _groundOpts(m, el) { const hf = homeField(m, el); return { typeAdvantage: hf === 'boost', typeWeak: hf === 'weak' }; }
function _setupClaimSlide(m) {
  const el = G.board[_setupCarouselIdx]?.element;
  if (!_isFreeTile(_setupCarouselIdx)) return _cardDetailBody(m);
  return _groundSlide(m, el);
}
function openSetupClaimDetail(i) {
  if (!_isFreeTile(_setupCarouselIdx)) return;   // hand is greyed until an open tile is picked
  openDetailSheet(myHand, i, _setupClaimAction, { title:`Claim Tile ${_setupCarouselIdx}`, renderItem: _setupClaimSlide });
}
function doSetupClaimTile(pos, iid) {
  SFX.claim && SFX.claim();
  send('setup_claim', { iid, tilePos: pos });
  selectedIid = null;
}

function renderSetupWaiting() {
  const cp = G.players[G.currentPlayer];
  updateStatusBar(false);
  updateHandStrip(true);
  document.getElementById('main-content').classList.remove('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  // v0.5.11: ring follows the newest claim during setup until the viewer browses
  { const t = _ringFollowTarget(true); if (_ringFollow && t != null) _setupCarouselIdx = t; }
  const claimed = G.board.filter(t => t.ownerId !== null && t.ownerId !== undefined && t.summon);
  const tileRows = claimed.map(t => {
    const owner = G.players.find(p => p.idx === t.ownerId);
    const elCol = TYPE_COLOR[t.element] || 'var(--text)';
    return `<div class="wc-claimed-row">
      <span class="wc-claimed-tile">Tile ${t.pos}</span>
      <span style="color:${elCol};font-size:11px;font-weight:600">${t.element}</span>
      <span style="font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.summon.name}</span>
      <span class="wc-claimed-owner" style="color:${owner?.color||'var(--text-mute)'}">${owner?.name||'?'}</span>
    </div>`;
  }).join('') || '<div style="color:var(--text-mute);font-size:12px;text-align:center;padding:12px 0;">No tiles claimed yet</div>';

  document.getElementById('main-content').innerHTML = `
    <div class="wc-wrap">
      <div class="wc-phase-hdr">${G.autoSetupRunning ? 'Auto Setup' : 'Setup Phase'} · Round ${G.setupRound||1} of 3${G.setupTotalTurns > 0 ? ` · Turn ${(G.setupTurnIdx||0)+1}/${G.setupTotalTurns}` : ''}</div>
      <div class="wc-whose">
        <div class="waiting-pulse"></div>
        <span style="color:${cp?.color||'var(--text)'};font-weight:600">${cp?.name||'?'}</span>
        <span style="color:var(--text-mute)"> is choosing…</span>
      </div>
      ${buildBoardRing(_setupCarouselIdx, true)}
      <div class="wc-claimed-panel">
        <div class="wc-claimed-hdr">Claimed So Far</div>
        ${tileRows}
      </div>
    </div>`;
  attachBoardRing();
}

function moveSetupCarousel(dir) {
  _setupCarouselIdx = (_setupCarouselIdx + dir + G.board.length) % G.board.length;
  renderSetupWaiting();
}

// Lightweight update for setup tile preview — avoids re-rendering the whole
// screen (which would destroy the input and lose focus mid-keystroke).
function updateSetupTilePreview() {
  const tileNum = parseInt(setupTileStr, 10);
  const tileValid = !isNaN(tileNum) && tileNum >= 0 && tileNum <= 27;
  const tile = tileValid ? G.board[tileNum] : null;
  const tileIsElemental = tile && tile.kind === 'element';
  const tileIsFree = tileIsElemental && (tile.ownerId === null || tile.ownerId === undefined);
  const canClaim = selectedIid && tileIsFree;

  let html = '';
  if (tileValid && tile) {
    if (!tileIsElemental) {
      html = `<div class="setup-tile-msg error">⚠ Tile ${tileNum} is a special tile — pick an elemental tile (not chest, temple, heal, or start).</div>`;
    } else if (!tileIsFree) {
      const owner = G.players.find(p => p.idx === tile.ownerId);
      html = `<div class="setup-tile-msg error">⚠ Tile ${tileNum} is already claimed${owner ? ' by ' + owner.name : ''}.</div>`;
    } else {
      html = `<div class="setup-tile-msg ok">✓ Tile ${tileNum} · <span style="color:${TYPE_COLOR[tile.element]||'var(--text)'}">${tile.element}</span></div>`;
    }
  }

  const previewEl = document.getElementById('setup-tile-preview');
  if (previewEl) previewEl.innerHTML = html;

  const ab = document.getElementById('action-bar');
  if (ab && ab.classList.contains('visible')) {
    const setupHint2 = !canClaim ? `<div class="action-hint">${!selectedIid ? '↑ Pick a summon above first' : !tileValid ? '↑ Enter a tile number (0–27)' : !tileIsElemental ? 'That tile is special — pick an elemental tile' : 'That tile is already claimed'}</div>` : '';
    ab.innerHTML = `${setupHint2}
      <button class="action-btn secondary" onclick="doSetupPass()">Pass</button>
      <button class="action-btn primary" onclick="doSetupClaim()" ${canClaim ? '' : 'disabled style="opacity:.4"'}>Claim Free ✦0</button>`;
  }
}

function doSetupClaim() {
  if (!selectedIid) return;
  // Read fresh from DOM in case oninput fired but setupTileStr is somehow stale
  const inputEl = document.getElementById('setup-tile-input');
  if (inputEl) setupTileStr = inputEl.value.trim();
  const tileNum = parseInt(setupTileStr, 10);
  if (isNaN(tileNum) || tileNum < 0 || tileNum > 27) return;
  send('setup_claim', { iid: selectedIid, tilePos: tileNum });
  selectedIid = null;
  setupTileStr = '';
}

function doSetupPass() {
  send('setup_pass');
  selectedIid = null;
  setupTileStr = '';
}

function renderClaim() {
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(false);   // v0.5.09: picker row already shows the hand
  document.getElementById('main-content').classList.add('no-hand');

  const tile = G.board[me.position];
  const pickerCards = myHand.map((m, i) => renderCard(m, {
    size:'full',
    dim: me.mana < m.cost || !(m.canUse ?? true),
    onclick: `openClaimDetail(${i})`,
    ..._groundOpts(m, tile && tile.element),   // v0.5.44: home / weak ground highlight, same as setup
  })).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner claim">
      <span class="resolve-icon">🚩</span>
      <div>
        <div class="resolve-title">Empty Tile — Claim It?</div>
        <div class="resolve-sub">Tile ${me.position} · <span style="color:${TYPE_COLOR[tile.element]}">${tile.element}</span> — station a summon to claim.</div>
      </div>
    </div>
    <div class="picker-label">Choose a summon to station</div>
    <div class="picker-scroll" id="claim-picker-scroll"><div class="scroll-inner">${pickerCards}</div></div>
    ${scrollNavHTML('claim-picker-scroll','claim-dot',myHand.length)}
    <div style="display:flex;justify-content:center;padding:20px 16px 8px;">
      ${renderPlayerTileCard(tile)}
    </div>`;

  attachShopScrollListener('claim-picker-scroll','claim-dot',myHand.length);
  selectedIid = null;
  _pickerBar(myHand.length ? 'Tap a summon to view and <b>claim</b>' : 'No summons in hand',
    `<button class="action-btn secondary" onclick="send('skip_claim')">Skip</button>`);
}

// ─── PICKER CONTEXTS ON THE SHARED SHEET (v0.5.08) ──────────────────────────
function _pickerBar(hintHtml, buttonsHtml) {
  const ab = document.getElementById('action-bar');
  ab.classList.add('visible');
  ab.innerHTML = `<div class="shop-tap-hint">${hintHtml}</div>${buttonsHtml}`;
}

// CLAIM
function _claimAction(m) {
  const me = G.players[myIdx];
  const label = `Claim · ${m.cost} ✦`;
  if (m.canUse === false) return { label, kind:'claim', disabled:true, reason:`🔒 Locked${m.conditionDesc ? ' — ' + m.conditionDesc : ''}` };
  if (me.mana < m.cost)  return { label, kind:'claim', disabled:true, reason:`Need ${m.cost - me.mana} more ✦ (you have ${me.mana})` };
  const t = G.board[me.position];
  return { label, kind:'claim', hint: t && t.element ? `Station on Tile ${me.position} · ${t.element}` : '', run: (mm) => { selectedIid = mm.iid; doClaim(); } };
}
function openClaimDetail(i) { const t = G.board[G.players[myIdx].position]; openDetailSheet(myHand, i, _claimAction, { title:'Claim Tile', renderItem: m => _groundSlide(m, t && t.element) }); }   // v0.5.44

// BATTLE — viewing a card previews it on the board; dismissing clears the preview
function _battleDefender() { const me = G.players[myIdx]; const t = G.board[me.position]; return t ? t.summon : null; }
function _battleAction(m) {
  const d = _battleDefender();
  let hint = '';
  if (d) { const e = typeEff(m, d.type); hint = `${e.label} vs ${d.name} (${d.hp}/${d.maxHp} HP)`; }
  return { label:'Attack!', kind:'battle', hint, run: (mm) => { selectedIid = mm.iid; doAttack(); } };
}
function _battleSlide(m) {
  const d = _battleDefender();
  if (!d) return _cardDetailBody(m);
  const e = typeEff(m, d.type);
  const banner = e.cls === 'strong'
    ? `<div class="mu-banner strong"><span class="mu-big">▲ 2× STRONG</span><span class="mu-sub">vs ${d.name} (${d.type})</span></div>`
    : e.cls === 'weak'
    ? `<div class="mu-banner weak"><span class="mu-big">▼ ½× WEAK</span><span class="mu-sub">vs ${d.name} (${d.type})</span></div>`
    : `<div class="mu-banner neutral"><span class="mu-big" style="font-size:15px">1× NEUTRAL</span><span class="mu-sub">vs ${d.name} (${d.type})</span></div>`;
  // swap the plain card for one carrying the glow / tint
  const body = _cardDetailBody(m).replace(renderCard(m, {size:'full', showCost:true}),
    renderCard(m, {size:'full', showCost:true, typeAdvantage: e.cls==='strong', typeWeak: e.cls==='weak'}));
  return banner + body;
}
function openBattleDetail(i) {
  openDetailSheet(myHand, i, _battleAction, {
    title:'Choose Attacker',
    renderItem: _battleSlide,
    onChange: (m) => { selectedIid = m.iid; send('preview_attacker', { iid: m.iid }); },
    onClose:  () => {
      selectedIid = null;
      if (G && G.phase === 'resolve:battle' && G.currentPlayer === myIdx) { send('preview_attacker', { iid: null }); setTimeout(render, 0); }
    },
  });
}

// TEMPLE — step 1: choose Ascendant; step 2: choose matching sacrifice
function _templeOfferAction(o) {
  const me = G.players[myIdx];
  const label = `Choose · ${o.cost} ✦`;
  if (!myHand.some(m => m.type === o.type && !m.isSpecial)) return { label, kind:'primary', disabled:true, reason:`Needs ${/^[AEIOU]/.test(o.type)?'an':'a'} ${o.type} summon in your hand to trade` };
  if (me.mana < o.cost) return { label, kind:'primary', disabled:true, reason:`Need ${o.cost - me.mana} more ✦ (you have ${me.mana})` };
  return { label, kind:'primary', hint:'Next: pick which summon to give up', run: (oo) => { selectedIid = oo.iid; tradeIid = null; render(); } };
}
function openTempleOfferDetail(i) { openDetailSheet(G.pendingTemple.offers, i, _templeOfferAction, { title:'Temple · Ascendants' }); }
function _templeSacAction(m) {
  const me = G.players[myIdx];
  const sp = G.pendingTemple.offers.find(o => o.iid === selectedIid);
  if (!sp) return null;
  const label = `Trade for ${sp.name} · ${sp.cost} ✦`;
  if (me.mana < sp.cost) return { label, kind:'gold', disabled:true, reason:`Need ${sp.cost - me.mana} more ✦ (you have ${me.mana})` };
  return { label, kind:'gold', hint:`${m.name} is given up permanently`, run: (mm) => { tradeIid = mm.iid; doTempleTrade(); } };
}
function openTempleSacDetail(i) {
  const sp = G.pendingTemple.offers.find(o => o.iid === selectedIid);
  if (!sp) return;
  const list = myHand.filter(m => m.type === sp.type && !m.isSpecial);
  openDetailSheet(list, i, _templeSacAction, { title:'Give Up a Summon' });
}

// ─── NOTIFICATION OVERLAY ────────────────────────────────────────────────────
function renderNotification(notif) {
  if (notif && notif.kind === 'omen') { renderOmenNotification(notif); return; }   // v0.5.38
  updateStatusBar(false);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const ts = TIER_STYLE[notif.tier] || TIER_STYLE.low;
  const wcSvg = WILD_CARD_ART[notif.cardId] || '';
  const wcPng = `/img/wildcards/wc-${notif.cardId}.png`;

  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding:22px 20px 28px;gap:16px;text-align:center">
      <div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif">🃏 Wild Card</div>
      <div style="font-size:13px;color:var(--text-mute)">
        Targeted by <span style="color:${notif.castByColor||ts.color};font-weight:700">${notif.castByName}</span>
      </div>

      <div onclick="_dismissNotif()"
        style="position:relative;width:160px;height:224px;border-radius:12px;border:2px solid ${ts.color};
               background:linear-gradient(160deg,${ts.color}28,${ts.color}08);
               overflow:hidden;cursor:pointer;box-shadow:0 0 28px ${ts.glow},0 4px 24px rgba(0,0,0,.5);
               flex-shrink:0;-webkit-tap-highlight-color:transparent">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;opacity:.85">${wcSvg}</div>
        <img src="${wcPng}" onerror="this.style.display='none'"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;bottom:0;left:0;right:0;
                    background:linear-gradient(to top,rgba(8,8,18,.96) 55%,transparent);
                    padding:10px 10px 12px;text-align:center">
          <div style="font-size:13px;font-family:'Cinzel',serif;font-weight:700;color:${ts.color};margin-bottom:3px">${notif.cardName}</div>
          <div style="font-size:9px;letter-spacing:.14em;color:${ts.color};opacity:.65;text-transform:uppercase">${ts.label}</div>
        </div>
        <div style="position:absolute;top:8px;right:9px;font-size:8px;letter-spacing:.1em;color:${ts.color};opacity:.55;text-transform:uppercase;font-family:'Cinzel',serif"></div>
      </div>

      <div style="background:var(--surface);border:1px solid ${ts.color}44;border-radius:10px;
                  padding:13px 18px;max-width:280px;width:100%;font-size:13px;color:var(--text);line-height:1.65;text-align:center">
        ${notif.cardDesc}
      </div>
      <button id="notif-dismiss-btn" onclick="_dismissNotif()"
        style="width:100%;max-width:280px;min-height:52px;border-radius:12px;border:1px solid ${ts.color};
               background:linear-gradient(135deg,${ts.color}38,${ts.color}14);color:var(--text);
               font-family:'Cinzel',serif;font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
               cursor:pointer;box-shadow:0 0 18px ${ts.glow};-webkit-tap-highlight-color:transparent">Dismiss</button>
    </div>`;
}
// v0.5.15: explicit Dismiss button (card tap still works); guard against double-send
function _dismissNotif() {
  const b = document.getElementById('notif-dismiss-btn');
  if (b) { if (b.disabled) return; b.disabled = true; b.style.opacity = '.5'; b.textContent = 'Dismissing…'; }
  send('dismiss_notification');
}

// ─── BATTLE RESULT CLASH ─────────────────────────────────────────────────────
let _setupClaimSeen        = false; // true after player dismisses setup instructions (resets each new game)
let _setupPanelIdx         = 0;    // which panel of the setup walkthrough is showing (0/1/2)
let _elimWarnSeen          = false; // true after player acknowledges elimination warning this turn
let _elimWarnTurn          = -1;    // tracks which turnCount the warning was shown for
let _battleResultTimer     = null;
let _battleResultLbId      = null;
let _battleResultDismissed = false;
let _battleResultPending   = false; // true = personal result is showing; hold render() until dismissed

// ─── BATTLE MUSIC ────────────────────────────────────────────────────────────
const _battleAudio = new Audio('/audio/battle.mp3');
_battleAudio.loop = false;
const BATTLE_MUSIC_BASE = 0.55;
_battleAudio.volume = BATTLE_MUSIC_BASE * _musicLvl();
let _battleMusicKey = null; // tracks which battle we played music for (prevent re-trigger on rebroadcast)
// v0.5.39: phones (iOS especially) only let an <audio> start from a socket message if it was started once inside a tap.
// Prime the battle track silently on the first tap so it can play when the battle screen opens.
(() => {
  const prime = () => {
    if (!_battleAudio.paused) return;
    _battleAudio.muted = true;
    const p = _battleAudio.play();
    const done = () => { _battleAudio.pause(); _battleAudio.currentTime = 0; _battleAudio.muted = false; };
    if (p && p.then) p.then(done).catch(() => { _battleAudio.muted = false; }); else done();
  };
  document.addEventListener('pointerdown', prime, { once: true, capture: true });
})();

function _tryPlayBattleMusic() {
  if (!G || myIdx === null) return;
  if (G.phase !== 'resolve:battle') return;
  if (G.currentPlayer !== myIdx) return; // only the attacker hears it
  const key = `${G.currentPlayer}-${G.turnCount}`;
  if (_battleMusicKey === key) return;  // already played for this attack
  _battleMusicKey = key;
  if (_musicLvl() <= 0) return;
  _battleAudio.volume = BATTLE_MUSIC_BASE * _musicLvl();
  _battleAudio.currentTime = 0;
  _battleAudio.play().catch(() => {});
}

function _stopBattleMusic() {
  if (_battleAudio.paused) return;
  // Fade out over 1200ms then stop
  const startVol = _battleAudio.volume;
  const step = 50; // ms per tick
  const ticks = 1200 / step;
  const decrement = startVol / ticks;
  const fade = setInterval(() => {
    if (_battleAudio.paused) { clearInterval(fade); return; }
    const next = _battleAudio.volume - decrement;
    if (next <= 0) {
      _battleAudio.volume = 0;
      _battleAudio.pause();
      _battleAudio.currentTime = 0;
      _battleAudio.volume = startVol; // restore for next play
      clearInterval(fade);
    } else {
      _battleAudio.volume = next;
    }
  }, step);
}

// ─── Lottie hit animation helpers (battle clash, player view) ────────────────

function playCardHitAnim(cardEl, animFile) {
  if (!cardEl || !animFile || typeof lottie === 'undefined') return;
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;width:260px;height:260px;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:30;filter:brightness(0) invert(1);';
  cardEl.style.position = 'relative';
  cardEl.appendChild(container);
  const anim = lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    path: `/animations/${animFile}.json`
  });
  anim.addEventListener('complete', () => { anim.destroy(); container.remove(); });
}

let _battleAnimLbId = null;
function renderBattleResult() {
  _stopBattleMusic(); // cut battle music as clash animation begins
  updateStatusBar(false);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const lb = G.lastBattle;
  if (!lb) { render(); return; }

  // Guard: don't reset the animation if the same battle is already playing or dismissed
  const lbId = `${lb.attackerIdx}-${lb.defOwnerIdx}-${lb.outcome}-${lb.atkDmg}-${lb.defDmg}`;
  if (_battleResultLbId === lbId) {
    // v0.5.23: already dismissed but the server is still on battle_result — show the waiting
    // screen instead of returning early (that left the old result on screen, so "Got it"
    // looked like it did nothing and had to be tapped again and again).
    if (_battleResultDismissed) { renderWaiting(); return; }
    if (_battleResultTimer !== null) return;
    if (_battleAnimLbId === lbId && document.querySelector('#main-content .p-clash-wrap')) return;   // v0.5.51: watchers — don't restart the sequence on every update
  }
  if (_battleResultLbId !== lbId) { _battleResultDismissed = false; _battleResultPending = false; }
  _battleResultLbId = lbId; _battleAnimLbId = lbId;
  if (_battleResultTimer) { clearTimeout(_battleResultTimer); _battleResultTimer = null; }

  const attPlayer = G.players[lb.attackerIdx];
  const defPlayer = lb.defOwnerIdx != null ? G.players.find(p => p.idx === lb.defOwnerIdx) : null;
  const eff = lb.attM && lb.defM ? typeEff(lb.attM, lb.defM.type) : null;
  const isAttacker = myIdx === lb.attackerIdx;
  const isDefender = myIdx === lb.defOwnerIdx;
  // v0.5.51: start both cards at their pre-battle HP (server v1.0.138 sends it; older servers → estimate)
  const _attHp0 = lb.attHpBefore != null ? lb.attHpBefore : Math.min(lb.attM.maxHp, lb.attM.hp + (lb.defDmg||0));
  const _defHp0 = lb.defHpBefore != null ? lb.defHpBefore : Math.min(lb.defM.maxHp, lb.defM.hp + (lb.atkDmg||0));

  // Phase 1: always show the clash animation for everyone
  const outcomeLabel = { attacker_wins:'Victory!', defender_wins:'Defender wins!', mutual:'Mutual!', stalemate:'Stalemate' }[lb.outcome] || lb.outcome;
  const outcomeColor = { attacker_wins:'#5dc97d', defender_wins:'#7f92e8', mutual:'#e0b050', stalemate:'#9184d9' }[lb.outcome] || 'var(--gold-glow)';
  document.getElementById('main-content').innerHTML = `
    <div class="p-clash-wrap">
      <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif;">⚔ Battle Result</div>
      <div class="p-clash-arena">
        <div class="p-clash-side left">
          <div class="p-clash-label">Attacker</div>
          <div class="p-clash-name" style="color:${attPlayer?.color||'var(--text)'}">${attPlayer?.name||'?'}</div>
          <div class="p-clash-hit">${renderCard({...lb.attM, hp:_attHp0},{size:'full',showCost:false})}</div>
          ${lb.defDmg > 0 ? `<div class="p-clash-dmg">-${lb.defDmg}</div>` : `<div class="p-clash-dmg zero">—</div>`}
        </div>
        <div class="p-clash-mid">
          <div class="p-clash-proj atk">⚔ ${lb.atkDmg}</div>
          <div class="p-clash-vs">VS</div>
          <div class="p-clash-proj def-proj">🛡 ${lb.defDmg}</div>
          ${eff ? `<div class="p-clash-eff">${eff.label}</div>` : ''}
          <div class="p-clash-outcome" style="color:${outcomeColor}">${outcomeLabel}</div>
        </div>
        <div class="p-clash-side right">
          <div class="p-clash-label">Defender</div>
          <div class="p-clash-name" style="color:${defPlayer?.color||'var(--text-dim)'}">${defPlayer?.name||'?'}</div>
          <div class="p-clash-hit">${renderCard({...lb.defM, hp:_defHp0},{size:'full',showCost:false})}</div>
          ${lb.atkDmg > 0 ? `<div class="p-clash-dmg">-${lb.atkDmg}</div>` : `<div class="p-clash-dmg zero">—</div>`}
        </div>
      </div>
    </div>`;

  // ── v0.5.51: strike sequence — attacker hits → defender HP drains → counter → attacker HP drains → outcome ──
  // (Stormtalon defending strikes first.) Each strike: projectile, Lottie hit, shake, damage pop, HP tween.
  const mc = document.getElementById('main-content');
  const stormtalonDefending = lb.defM && lb.defM.id === 'stormtalon';
  const sideEl = side => mc && mc.querySelector(`.p-clash-side.${side}`);
  const tweenHp = (side, m, from, to) => {
    const el = sideEl(side); if (!el) return;
    const fill = el.querySelector('.mc-hp-fill'), num = el.querySelector('.mc-hp-num');
    const pct = v => Math.max(0, Math.min(100, Math.round(v / m.maxHp * 100)));
    if (fill) { fill.style.width = pct(to) + '%'; if (to / m.maxHp < .35) fill.style.background = '#b05050'; }
    if (num) {
      const t0 = performance.now(), dur = 700;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        num.textContent = `${Math.max(0, Math.round(from + (to - from) * e))}/${m.maxHp}`;
        if (k < 1 && num.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  };
  // strike(by): 'att' hits the right card, 'def' hits the left card
  const strike = by => {
    if (!mc || !mc.isConnected) return;
    const target = by === 'att' ? 'right' : 'left';
    const dmg    = by === 'att' ? lb.atkDmg : lb.defDmg;
    const proj = mc.querySelector(by === 'att' ? '.p-clash-proj.atk' : '.p-clash-proj.def-proj');
    if (proj) proj.classList.add('go');
    setTimeout(() => {
      const el = sideEl(target); if (!el || !el.isConnected) return;
      const hit = el.querySelector('.p-clash-hit');
      const anim = typeof lottie !== 'undefined' ? getHitAnim(by === 'att' ? lb.attM : lb.defM) : null;
      if (hit) { if (anim && dmg > 0) playCardHitAnim(hit, anim); hit.classList.remove('go'); void hit.offsetWidth; hit.classList.add('go'); }
      const pop = el.querySelector('.p-clash-dmg'); if (pop) pop.classList.add('go');
      if (by === 'att') tweenHp('right', lb.defM, _defHp0, lb.defM.hp);
      else              tweenHp('left',  lb.attM, _attHp0, lb.attM.hp);
    }, 350);
  };
  const first  = stormtalonDefending ? 'def' : 'att';
  const second = stormtalonDefending ? 'att' : 'def';
  const secondHappens = stormtalonDefending ? lb.atkDmg > 0 : lb.defDmg > 0;
  const T1 = 900, T2 = 2100, tOut = secondHappens ? 3200 : 2200;
  setTimeout(() => strike(first), T1);
  if (secondHappens) setTimeout(() => strike(second), T2);
  setTimeout(() => { const o = mc && mc.querySelector('.p-clash-outcome'); if (o) o.classList.add('go'); }, tOut);

  // Phase 2: attacker/defender get a personal result screen after the outcome lands
  if (isAttacker || isDefender) {
    _battleResultPending = true; // block render() immediately so phase change can't skip us
    _battleResultTimer = setTimeout(() => {
      _battleResultTimer = null;
      _renderPersonalBattleResult(lb, isAttacker);
    }, tOut + 1400);
  }
}

function _renderPersonalBattleResult(lb, isAttacker) {
  const mc = document.getElementById('main-content');
  if (!mc) return; // _battleResultPending already blocks render(), so phase check is unnecessary

  const attPlayer = G.players[lb.attackerIdx];
  const defPlayer = lb.defOwnerIdx != null ? G.players.find(p => p.idx === lb.defOwnerIdx) : null;
  const eff       = lb.attM && lb.defM ? typeEff(lb.attM, lb.defM.type) : null;
  const myMonster    = isAttacker ? lb.attM : lb.defM;
  const theirMonster = isAttacker ? lb.defM : lb.attM;
  const opponent     = isAttacker ? defPlayer : attPlayer;
  const myDmgTaken   = isAttacker ? lb.defDmg : lb.atkDmg;
  const theirDmgTaken= isAttacker ? lb.atkDmg : lb.defDmg;

  let personalOutcome;
  if      (lb.outcome === 'stalemate')     personalOutcome = 'stalemate';
  else if (lb.outcome === 'mutual')        personalOutcome = 'mutual';
  else if (lb.outcome === 'attacker_wins') personalOutcome = isAttacker ? 'win' : 'loss';
  else                                     personalOutcome = isAttacker ? 'loss' : 'win';

  const cfg = {
    win:       { icon:'🏆', headline:'Victory!',  accent:'#5dc97d', glow:'rgba(93,201,125,0.15)',  sub:'You won the battle!' },
    loss:      { icon:'💀', headline:'Defeated!', accent:'#e05252', glow:'rgba(224,82,82,0.15)',   sub:'Your summon was destroyed.' },
    stalemate: { icon:'⚔️', headline:'Stalemate', accent:'#9184d9', glow:'rgba(145,132,217,0.15)', sub:'Both summons survived. Resolve next turn.' },
    mutual:    { icon:'💥', headline:'Mutual!',   accent:'#e0b050', glow:'rgba(224,176,80,0.15)',  sub:'Both summons were destroyed.' },
  }[personalOutcome];

  // v0.5.05: effects that happened to/for MY side (my abilities + things done to me)
  const mySide = isAttacker ? 'att' : 'def';
  const myFx = (Array.isArray(lb.effects) ? lb.effects : []).filter(e => e.side === mySide);
  const fxHtml = myFx.length ? `<div class="bfx-list"><div class="bfx-list-title">Abilities triggered</div>${myFx.map(battleFxRow).join('')}</div>` : '';
  const myManaDelta   = isAttacker ? (lb.attManaDelta ?? null) : (lb.defManaDelta ?? null);
  const manaLine = myManaDelta == null ? '' : (() => {
    const sign = myManaDelta >= 0 ? '+' : '';
    const col  = myManaDelta > 0 ? '#5dc97d' : myManaDelta < 0 ? '#e05252' : 'var(--text-mute)';
    return `<div style="margin-top:4px;font-size:13px;font-weight:700;color:${col}">Mana: ${sign}${myManaDelta}</div>`;
  })();

  // Fade out, swap content, fade in
  mc.style.transition = 'opacity .28s ease';
  mc.style.opacity = '0';
  setTimeout(() => {
    if (!mc.isConnected) return;
    mc.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:18px 16px;gap:14px;text-align:center">
        <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif;">⚔ Battle Result</div>
        <div style="background:${cfg.glow};border:2px solid ${cfg.accent};border-radius:14px;padding:14px 24px;
                    width:100%;max-width:320px;display:flex;flex-direction:column;align-items:center;gap:6px">
          <div style="font-size:32px">${cfg.icon}</div>
          <div style="font-size:24px;font-family:'Cinzel',serif;font-weight:700;color:${cfg.accent}">${cfg.headline}</div>
          <div style="font-size:12px;color:var(--text-mute)">${cfg.sub}</div>
          ${manaLine}
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;justify-content:center;width:100%">
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-mute)">You</div>
            ${myMonster ? renderCard(myMonster,{size:'full',showCost:false}) : ''}
            ${myDmgTaken > 0 ? `<div style="font-size:13px;color:#e05252;font-weight:700">-${myDmgTaken} HP</div>` : `<div style="font-size:11px;color:var(--text-mute)">No damage</div>`}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:55px;gap:5px">
            <div style="font-size:16px;color:var(--text-dim)">VS</div>
            ${eff ? `<div class="type-eff-badge ${eff.cls}" style="font-size:9px">${eff.label}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
            <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${opponent?.color||'var(--text-mute)'}">${opponent?.name||'Opponent'}</div>
            ${theirMonster ? renderCard(theirMonster,{size:'full',showCost:false}) : ''}
            ${theirDmgTaken > 0 ? `<div style="font-size:13px;color:#e05252;font-weight:700">-${theirDmgTaken} HP</div>` : `<div style="font-size:11px;color:var(--text-mute)">No damage</div>`}
          </div>
        </div>
        ${fxHtml}
        <button class="action-btn primary" style="min-width:180px;margin-top:4px"
          onclick="dismissBattleResult()">Got it</button>
      </div>`;
    mc.style.opacity = '1';
  }, 280);
}

function dismissBattleResult() {
  _battleResultDismissed = true;
  _battleResultPending   = false;
  if (_battleResultTimer) { clearTimeout(_battleResultTimer); _battleResultTimer = null; }
  // Fade out, then let render() route to whatever phase the server is already in
  const mc = document.getElementById('main-content');
  if (mc) {
    mc.style.transition = 'opacity .2s ease';
    mc.style.opacity = '0';
    setTimeout(() => { mc.style.opacity = ''; mc.style.transition = ''; render(); }, 200);
  } else {
    render();
  }
}

// ─── BATTLE ──────────────────────────────────────────────────────────────────
function renderBattle() {
  _tryPlayBattleMusic(); // play battle music for the attacker only
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(false);   // v0.5.09: picker row already shows the hand
  document.getElementById('main-content').classList.add('no-hand');

  const tile = G.board[me.position];
  const defM = tile?.summon;
  const defOwner = tile ? G.players[tile.ownerId] : null;
  const selM = myHand.find(m => m.iid === selectedIid);

  let effBadge = '';
  if (selM && defM) {
    const eff = typeEff(selM, defM.type);
    effBadge = `<div style="text-align:center;padding-bottom:8px"><span class="type-eff-badge ${eff.cls}">${eff.label}</span></div>`;
  }

  // Compute type advantage for each hand card vs the defender
  function hasTypeAdvantage(attacker, defender) {
    if (!defender) return false;
    const strong1 = TYPE_STRONG[attacker.type] === defender.type;
    const strong2 = attacker.type2 ? TYPE_STRONG[attacker.type2] === defender.type : false;
    return strong1 || strong2;
  }

  const pickerCards = myHand.map((m, i) => renderCard(m, {
    size:'full',
    dim: false,  // Ascendants always usable in battle; condition only gates tile claiming
    onclick: `openBattleDetail(${i})`,
    typeAdvantage: !!defM && typeEff(m, defM.type).cls === 'strong',
    typeWeak:      !!defM && typeEff(m, defM.type).cls === 'weak',
  })).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner battle">
      <span class="resolve-icon">⚔️</span>
      <div>
        <div class="resolve-title">Enemy Tile!</div>
        <div class="resolve-sub">Owned by <span style="color:${defOwner?.color}">${defOwner?.name || '?'}</span> — fight or retreat (−8 ✦ penalty).</div>
      </div>
    </div>
    ${defM ? `<div class="battle-matchup">
      <div class="battle-slot"><div class="battle-slot-label">Defending</div>${renderCard(defM,{size:'full',showCost:false})}</div>
      <div class="vs-badge">VS</div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><div class="battle-slot-label">Your Attacker</div>${selM ? renderCard(selM,{size:'full',showCost:false, typeAdvantage: typeEff(selM, defM.type).cls==='strong', typeWeak: typeEff(selM, defM.type).cls==='weak'}) : `<div style="width:130px;height:186px;border-radius:10px;border:2px dashed var(--border2);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-mute);text-align:center;padding:8px">Tap a card below</div>`}</div>
    </div>
    ${effBadge}` : ''}
    <div class="picker-label">Choose your attacker</div>
    <div class="picker-scroll" id="battle-picker-scroll"><div class="scroll-inner">${pickerCards}</div></div>
    ${scrollNavHTML('battle-picker-scroll','battle-dot',myHand.length)}`;

  attachShopScrollListener('battle-picker-scroll','battle-dot',myHand.length);

  _pickerBar(myHand.length ? 'Tap a summon to view and <b>attack</b>' : 'No summons in hand',
    `<button class="action-btn danger-btn" onclick="doRetreat()">Retreat (−8 ✦)</button>`);
}

// ─── OWN TILE ────────────────────────────────────────────────────────────────
function renderOwn() {
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(false);   // v0.5.09: swap row already shows the hand
  document.getElementById('main-content').classList.add('no-hand');

  const tile = G.board[me.position];
  const stationed = tile?.summon;
  const missing = stationed ? stationed.maxHp - stationed.hp : 0;
  const canHeal = stationed && missing > 0 && me.mana >= 5;
  const canSwap = myHand.length > 0; // Swap is net-zero (stationed returns to hand) — full hand is always valid
  const CHANGE_COST = 18;

  const swapCards = myHand.map((m, i) => renderCard(m, {
    size:'full',
    dim: me.mana < m.cost || !(m.canUse ?? true),
    onclick: `openSwapDetail(${i})`,
    ..._groundOpts(m, tile && tile.element),   // v0.5.44
  })).join('');

  const elBtns = ['Light','Dark','Arcane','Undead','Beast','Nature'].map(el =>
    `<button class="el-btn${tile.element===el?' selected':''}" style="${tile.element===el?`background:${TYPE_COLOR[el]}33;border-color:${TYPE_COLOR[el]};color:${TYPE_COLOR[el]}`:''}" onclick="doChangeElement('${el}')">${el}</button>`
  ).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner own">
      <span class="resolve-icon">🏠</span>
      <div>
        <div class="resolve-title">Your Tile</div>
        <div class="resolve-sub">Tile ${me.position} · <span style="color:${TYPE_COLOR[tile.element]}">${tile.element}</span>${stationed ? ` · ${stationed.name} stationed (${stationed.hp}/${stationed.maxHp} HP)` : ' · Empty'}</div>
      </div>
    </div>
    ${stationed ? `
    <div class="own-tile-options">
      <div class="own-tile-opt${!canHeal ? ' unaffordable' : ''}" onclick="${canHeal ? 'doHeal()' : ''}">
        <span class="own-tile-opt-icon">💚</span>
        <div class="own-tile-opt-text">
          <div class="own-tile-opt-name">Heal ${stationed.name}</div>
          <div class="own-tile-opt-desc">${missing > 0 ? `+20 HP · ${stationed.hp} → ${Math.min(stationed.maxHp, stationed.hp + 20)} / ${stationed.maxHp}` : 'Already at full HP'}</div>
        </div>
        <span class="own-tile-opt-cost">5 ✦</span>
      </div>
      <div class="own-tile-opt" onclick="doSacrificeTile()" style="border-color:rgba(180,60,60,.35)">
        <span class="own-tile-opt-icon">💀</span>
        <div class="own-tile-opt-text">
          <div class="own-tile-opt-name">Sacrifice ${stationed.name}</div>
          <div class="own-tile-opt-desc">Destroy summon · tile goes neutral</div>
        </div>
        <span class="own-tile-opt-cost" style="color:#e07070">+15 ✦</span>
      </div>
    </div>
    ${canSwap ? `<div class="picker-label">Swap stationed summon <span style="text-transform:none;letter-spacing:0;color:var(--text-mute);font-weight:400">· tap a card</span></div><div class="picker-scroll" id="own-swap-scroll"><div class="scroll-inner">${swapCards}</div></div>${scrollNavHTML('own-swap-scroll','own-swap-dot',myHand.length)}` : ''}` : ''}
    <div style="padding:12px 16px 4px"><div class="picker-label" style="padding:0;margin-bottom:8px">Change tile element (${CHANGE_COST} ✦)</div>
    <div class="element-pick">${elBtns}</div></div>`;

  if (canSwap && myHand.length > 1) attachShopScrollListener('own-swap-scroll','own-swap-dot',myHand.length);

  selectedIid = null;
  _pickerBar(stationed && canSwap ? 'Heal, sacrifice, change element, or tap a card to <b>swap</b>' : 'Choose an action above',
    `<button class="action-btn secondary" onclick="send('skip_own')">Leave</button>`);
}

// v0.5.09: own-tile swap on the shared sheet
function _swapAction(m) {
  const me = G.players[myIdx];
  const t = G.board[me.position];
  const st = t && t.summon;
  const label = `Swap in · ${m.cost} ✦`;
  if (m.canUse === false) return { label, kind:'primary', disabled:true, reason:`🔒 Locked${m.conditionDesc ? ' — ' + m.conditionDesc : ''}` };
  if (me.mana < m.cost)  return { label, kind:'primary', disabled:true, reason:`Need ${m.cost - me.mana} more ✦ (you have ${me.mana})` };
  return { label, kind:'primary', hint: st ? `${st.name} returns to your hand (${st.hp}/${st.maxHp} HP)` : '', run: (mm) => { selectedIid = mm.iid; doSwap(); } };
}
function openSwapDetail(i) { const t = G.board[G.players[myIdx].position]; openDetailSheet(myHand, i, _swapAction, { title:'Swap Summon', renderItem: m => _groundSlide(m, t && t.element) }); }   // v0.5.44

function doSacrificeTile() {
  if (!confirm('Sacrifice this summon for +15✦? The tile will go neutral.')) return;
  send('sacrifice_tile');
}

// ─── CHEST ───────────────────────────────────────────────────────────────────
function renderChest() {
  const me = G.players[myIdx];
  const chest = G.pendingChest;
  if (!chest) return;

  // Play chest reveal sound once when this screen first renders
  if (!renderChest._played || renderChest._lastPhase !== G.phase) {
    SFX.chest();
    renderChest._played = true;
    renderChest._lastPhase = G.phase;
  }

  updateStatusBar(true);
  const needPicker = chest.kind === 'potion' || chest.kind === 'charm';
  updateHandStrip(needPicker);
  document.getElementById('main-content').classList.remove('no-hand');

  const rarityColor = {Common:'#4f9153',Uncommon:'#9184d9',Rare:'#a97b40'}[chest.rarity] || '#888';
  const titles = {potion:'Healing Potion',charm:'Battle Charm',warp:'Warp Portal','free_monster':'Free Summon'};
  const descs = {
    potion: `${chest.tier} Potion — ${chest.tier==='Minor'?'heal 15 HP flat':chest.tier==='Major'?'heal 50% of missing HP':'full heal!'}`,
    charm: 'Assign to any summon — +25% damage on their next battle.',
    warp: 'Warp to a random tile, or discard and stay put.',
    free_monster: myHand.length >= 5 ? 'Hand full — reward lost!' : 'A free summon was added to your hand!',
  };

  // Picker for stationed summons (all tiles you own)
  const stationedTiles = G.board.filter(t => t.ownerId === myIdx && t.summon);

  let pickerHtml = '';
  if (chest.kind === 'potion') {
    const POTION_MANA = { Minor: 3, Major: 6, Full: 10 };
    const convertMana = POTION_MANA[chest.tier] || 3;
    // Hurt monsters from hand AND stationed tiles (hp < maxHp only)
    const hurtHand = myHand.filter(m => m.hp < m.maxHp);
    const hurtStationed = stationedTiles.filter(t => t.summon.hp < t.summon.maxHp);
    const makeHealCard = (m, id) => {
      const missing = m.maxHp - m.hp;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:5px">
        ${renderCard(m, {size:'full', selected: selectedIid===id, showCost:false, onclick:`selectCard(${id})`})}
        <div style="font-size:11px;font-weight:600;color:#b05050;font-variant-numeric:tabular-nums">−${missing} HP</div>
      </div>`;
    };
    const cards = [
      ...hurtHand.map(m => makeHealCard(m, m.iid)),
      ...hurtStationed.map(t => makeHealCard(t.summon, t.summon.iid))
    ].join('');
    if (cards) {
      pickerHtml = `<div class="picker-label">Choose a summon to heal</div><div class="picker-scroll"><div class="scroll-inner" style="padding-bottom:32px">${cards}</div></div>`;
    } else {
      pickerHtml = `<div style="padding:16px;text-align:center;font-size:13px;color:var(--text-dim);line-height:1.6">All your summons are at full health.<br>Convert this potion to <strong style="color:var(--gold-glow)">${convertMana}✦ mana</strong> instead?</div>`;
    }
  } else if (chest.kind === 'charm') {
    const handCards = myHand.map(m => renderCard(m, {size:'full', selected: selectedIid===m.iid, showCost:false, onclick:`selectCard(${m.iid})`})).join('');
    const stCards = stationedTiles.map(t => renderCard(t.summon, {size:'full', selected: selectedIid===t.pos, showCost:false, onclick:`selectCard(${t.pos})`})).join('');
    pickerHtml = `<div class="picker-label">Assign charm to a summon</div><div class="picker-scroll"><div class="scroll-inner">${handCards}${stCards}</div></div>`;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner chest">
      <span class="resolve-icon">📦</span>
      <div><div class="resolve-title">Treasure Chest!</div><div class="resolve-sub">You drew a reward.</div></div>
    </div>
    <div class="chest-reveal">
      <div class="chest-icon-big">${chest.icon}</div>
      <div style="font-size:11px;font-weight:600;color:${rarityColor};text-transform:uppercase;letter-spacing:.12em;font-family:'Cinzel',serif;margin-bottom:8px">${chest.rarity}</div>
      <div class="chest-reward-title">${titles[chest.kind]||chest.kind}</div>
      <div class="chest-reward-desc">${descs[chest.kind]||''}</div>
      ${chest.kind === 'free_monster' && chest.summon ? `
        <div style="display:flex;justify-content:center;padding-top:16px;">
          ${renderCard(chest.summon, {size:'full', showCost:false})}
        </div>` : ''}
    </div>
    ${pickerHtml}`;

  const ab = document.getElementById('action-bar');
  ab.classList.add('visible');
  if (chest.kind === 'potion') {
    const POTION_MANA = { Minor: 3, Major: 6, Full: 10 };
    const convertMana = POTION_MANA[chest.tier] || 3;
    const hasHurt = myHand.some(m => m.hp < m.maxHp) || stationedTiles.some(t => t.summon.hp < t.summon.maxHp);
    if (selectedIid !== null) {
      ab.innerHTML = `<button class="action-btn secondary" onclick="send('chest_skip')">Convert (${convertMana}✦)</button>
        <button class="action-btn primary" onclick="doApplyPotion()">Apply Potion</button>`;
    } else if (hasHurt) {
      ab.innerHTML = `<button class="action-btn secondary" onclick="send('chest_skip')">Convert (${convertMana}✦)</button>
        <button class="action-btn primary" disabled style="opacity:.4">↑ Select a summon</button>`;
    } else {
      ab.innerHTML = `<button class="action-btn primary" style="width:100%" onclick="send('chest_skip')">Convert to ${convertMana}✦</button>`;
    }
  } else if (chest.kind === 'charm') {
    if (selectedIid !== null) {
      ab.innerHTML = `<button class="action-btn secondary" onclick="send('chest_skip')">Skip</button>
        <button class="action-btn primary" onclick="doAssignCharm()">Assign Charm</button>`;
    } else {
      ab.innerHTML = `<button class="action-btn secondary" onclick="send('chest_skip')">Skip</button>
        <button class="action-btn primary" disabled style="opacity:.4">Select Summon</button>`;
    }
  } else if (chest.kind === 'warp') {
    ab.innerHTML = `<button class="action-btn secondary" onclick="send('chest_discard')">Discard</button>
      <button class="action-btn primary" onclick="send('chest_warp')">Warp!</button>`;
  } else {
    ab.innerHTML = `<button class="action-btn primary" style="width:100%" onclick="send('chest_skip')">Continue</button>`;
  }
}

// ─── TEMPLE ──────────────────────────────────────────────────────────────────
function renderTemple() {
  const me = G.players[myIdx];
  if (!G.pendingTemple) return;

  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');

  const selSpecial = G.pendingTemple.offers.find(o => o.iid === selectedIid);
  const selSacrifice = selSpecial ? myHand.find(m => m.iid === tradeIid) : null;

  const specialCards = G.pendingTemple.offers.map((o, oi) => {
    const canTrade = myHand.some(m => m.type === o.type) && me.mana >= o.cost;
    return `<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px">
      ${renderCard(o, {size:'full', selected: selectedIid===o.iid, dim: !canTrade, onclick:`openTempleOfferDetail(${oi})`})}
      <div style="font-size:10px;color:var(--text-mute);font-family:'Cinzel',serif;letter-spacing:.08em">${o.type}</div>
    </div>`;
  }).join('');

  const sacrificeable = selSpecial
    ? myHand.filter(m => m.type === selSpecial.type && !m.isSpecial)
    : myHand.filter(m => G.pendingTemple.offers.some(o => o.type === m.type));
  const sacrificeCards = sacrificeable.map((m, si) =>
    renderCard(m, {size:'full', showCost:false, onclick:`openTempleSacDetail(${si})`})
  ).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner temple">
      <span class="resolve-icon">🏛</span>
      <div>
        <div class="resolve-title">Temple of Ascendants</div>
        <div class="resolve-sub">Trade a matching summon for an Ascendant. You can only use it if the condition is met.</div>
      </div>
    </div>
    <div class="picker-label">Ascendant offers (3)</div>
    <div class="picker-scroll" id="temple-special-scroll"><div class="scroll-inner">${specialCards}</div></div>
    ${scrollNavHTML('temple-special-scroll','temple-sp-dot',G.pendingTemple.offers.length)}
    <div style="height:12px"></div>
    ${selSpecial ? `<div class="picker-label">Sacrifice a ${selSpecial.type} summon (${selSpecial.cost} ✦)</div><div class="picker-scroll" id="temple-sac-scroll"><div class="scroll-inner">${sacrificeCards}</div></div>${scrollNavHTML('temple-sac-scroll','temple-sac-dot',sacrificeable.length)}` : `<div style="padding:0 16px 16px;font-size:12px;color:var(--text-mute)">Tap an Ascendant above to see details and choose it.</div>`}`;

  attachShopScrollListener('temple-special-scroll','temple-sp-dot',G.pendingTemple.offers.length);
  if (selSpecial) attachShopScrollListener('temple-sac-scroll','temple-sac-dot',sacrificeable.length);

  _pickerBar(selSpecial ? `Tap a <b>${selSpecial.type}</b> summon to give up` : 'Tap an Ascendant to view and <b>choose</b>',
    `${selSpecial ? `<button class="action-btn secondary" onclick="selectedIid=null;tradeIid=null;render()">Back</button>` : ''}<button class="action-btn secondary" onclick="send('temple_leave')">Leave</button>`);
}

// ─── HEAL TILE ───────────────────────────────────────────────────────────────
function renderHealTile() {
  const SHRINE_COST = 10;
  const SHRINE_HEAL = 10;
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');

  const canAfford = me.mana >= SHRINE_COST;

  // Gather all monsters that would be healed
  const stationedTiles = G.board.filter(t => t.ownerId === myIdx && t.summon);
  const allMonsters = [
    ...stationedTiles.map(t => ({ m: t.summon, label: 'Stationed' })),
    ...(myHand || []).map(m => ({ m, label: 'Hand' })),
  ];
  const healable = allMonsters.filter(({ m }) => m.hp < m.maxHp);

  const elColor = t => TYPE_COLOR[t.type] || '#888';

  const monsterRows = allMonsters.map(({ m, label }) => {
    const gain = Math.min(SHRINE_HEAL, m.maxHp - m.hp);
    const pct = Math.round((m.hp / m.maxHp) * 100);
    const pctAfter = Math.min(100, Math.round(((m.hp + gain) / m.maxHp) * 100));
    const col = elColor(m);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
        <div style="width:6px;height:40px;border-radius:3px;background:${col};opacity:.7;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-family:Cinzel,serif;color:${col};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name}</div>
          <div style="font-size:10px;color:var(--text-mute);margin-bottom:4px">${label} · ${m.hp}/${m.maxHp} HP</div>
          <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;position:relative">
            <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${col};border-radius:3px;opacity:.5;transition:width .3s"></div>
            ${gain > 0 ? `<div style="position:absolute;left:${pct}%;top:0;height:100%;width:${pctAfter-pct}%;background:#5fb36a;border-radius:3px"></div>` : ''}
          </div>
        </div>
        <div style="font-size:12px;font-weight:700;flex-shrink:0;color:${gain>0?'#5fb36a':'var(--text-mute)'}">${gain > 0 ? `+${gain}` : '✓ Full'}</div>
      </div>`;
  }).join('');

  const emptyMsg = allMonsters.length === 0
    ? `<div style="color:var(--text-mute);font-size:12px;padding:16px;text-align:center">No monsters to heal.</div>`
    : '';

  document.getElementById('main-content').innerHTML = `
    <div class="resolve-banner healing">
      <span class="resolve-icon">💚</span>
      <div>
        <div class="resolve-title">Healing Shrine</div>
        <div class="resolve-sub">All your monsters — stationed &amp; in hand — heal +${SHRINE_HEAL} HP for ${SHRINE_COST} ✦</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;padding:0 4px 8px">${monsterRows}${emptyMsg}</div>`;

  const ab = document.getElementById('action-bar');
  ab.classList.add('visible');
  ab.innerHTML = `<button class="action-btn secondary" onclick="send('heal_tile_skip')">Skip</button>
    <button class="action-btn primary"${canAfford && healable.length > 0 ? '' : ' disabled style="opacity:.4"'} onclick="${canAfford && healable.length > 0 ? "send('heal_tile_apply',{})" : ''}">Heal All · ${SHRINE_COST} ✦</button>`;
}

// ─── ELIMINATION WARNING ─────────────────────────────────────────────────────
function renderEliminationWarning() {
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;gap:20px;text-align:center;">
      <div style="font-size:52px;animation:pulseRed 1.2s ease-in-out infinite">⚠️</div>
      <div style="font-family:'Cinzel',serif;font-size:18px;letter-spacing:.1em;color:#e05252;text-transform:uppercase;">Danger Zone</div>
      <div style="font-size:13px;line-height:1.6;color:var(--text-dim);max-width:280px">
        You own <strong style="color:#e05252">no tiles</strong>.<br>
        Claim a tile this turn or you'll be <strong style="color:#e05252">eliminated</strong> when your turn ends.
      </div>
      <div style="font-size:11px;color:var(--text-mute);max-width:260px;line-height:1.5">
        You still have your shop phase and your roll — use them wisely.
      </div>
    </div>`;
  const ab = document.getElementById('action-bar');
  ab.classList.add('visible');
  ab.innerHTML = `<button class="action-btn primary" style="background:#e05252;border-color:#e05252"
    onclick="_elimWarnSeen=true;render()">Continue to Shop →</button>`;
}

// ─── ELIMINATED SPECTATOR SCREEN ─────────────────────────────────────────────
function renderEliminated() {
  updateStatusBar(false);
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');

  const me = G.players[myIdx];
  const activePlayers = G.players.filter(p => !p.eliminated);
  const currentP = G.players[G.currentPlayer];

  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;gap:18px;text-align:center;">
      <div style="font-size:44px">💀</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.1em;color:#e05252;text-transform:uppercase;">Eliminated</div>
      <div style="font-size:12px;color:var(--text-mute)">You owned 0 tiles at the end of your turn.</div>
      <div style="width:100%;background:var(--surface2);border-radius:12px;padding:16px;">
        <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.12em;color:var(--text-mute);text-transform:uppercase;margin-bottom:10px;">Still Playing</div>
        ${activePlayers.map(p => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border2);">
            <svg width="20" height="20" viewBox="0 0 20 20">${sigilShape(p.idx,10,10,5,p.color)}</svg>
            <div style="flex:1;text-align:left;font-size:12px;color:${p.color};font-family:'Cinzel',serif">${p.name}</div>
            <div style="font-size:11px;color:var(--text-mute)">${G.board.filter(t=>t.ownerId===p.idx).length} tiles</div>
          </div>`).join('')}
      </div>
      <div style="font-size:11px;color:var(--text-mute)">
        ${currentP ? `${currentP.name}'s turn` : 'Watching game…'}
      </div>
    </div>`;
}

// ─── ROUND CALLOUT ────────────────────────────────────────────────────────────
function renderRoundCallout() {
  updateStatusBar(false);
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');
  const type = G.roundCallout || 'penultimate';
  const isPenultimate = type === 'penultimate';
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:32px;
      background:${isPenultimate ? 'linear-gradient(180deg,rgba(80,40,0,.5),transparent)' : 'linear-gradient(180deg,rgba(60,10,90,.6),transparent)'};
      border-radius:16px;">
      <div style="font-size:64px">${isPenultimate ? '⚠️' : '☠️'}</div>
      <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;letter-spacing:.12em;text-align:center;
        color:${isPenultimate ? '#f59e0b' : '#e879f9'};
        text-shadow:0 0 20px ${isPenultimate ? 'rgba(245,158,11,.5)' : 'rgba(232,121,249,.5)'};">
        ${isPenultimate ? 'PENULTIMATE ROUND' : 'FINAL ROUND'}
      </div>
      <div style="font-size:14px;color:var(--text-muted,rgba(255,255,255,.45));letter-spacing:.08em;text-align:center;font-family:'Cinzel',serif;">
        ${isPenultimate ? 'One more round after this!' : 'This is the last round!'}
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;">
        <div class="wait-dot" style="animation-delay:0s"></div>
        <div class="wait-dot" style="animation-delay:.2s"></div>
        <div class="wait-dot" style="animation-delay:.4s"></div>
      </div>
    </div>`;
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
function renderGameOver() {
  updateStatusBar(false);
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');

  const rankings = G.rankings || G.players.map(p => ({...p, tiles: G.board.filter(t=>t.ownerId===p.idx).length}))
    .sort((a,b) => b.tiles - a.tiles || b.mana - a.mana);
  const winner = rankings[0];
  const wasLastStanding = winner && rankings[0].wasLastStanding;

  const rows = rankings.map((p,i) => `
    <div class="standing-row${i===0?' winner':''}">
      <div class="standing-rank${i===0?' first':''}">${['🥇','🥈','🥉'][i]||i+1}</div>
      <svg width="24" height="24" viewBox="0 0 24 24">${sigilShape(p.idx,12,12,6,p.color)}</svg>
      <div class="standing-info">
        <div class="standing-name" style="color:${p.color}">
          ${p.name}${p.idx===myIdx?' (you)':''}
          ${p.eliminated ? `<span style="font-size:9px;color:#e05252;margin-left:4px;font-family:Inter,sans-serif">${p.forfeited ? '🏳 left' : '💀 eliminated'}</span>` : ''}
        </div>
        <div class="standing-stats">${p.tiles} tiles · ${p.mana} ✦</div>
      </div>
    </div>`).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="gameover-hero">
      <div class="trophy-icon">${wasLastStanding ? '⚔️' : '🏆'}</div>
      <div class="gameover-winner">${winner.name} Wins!</div>
      <div class="gameover-sub">${wasLastStanding ? 'Last Player Standing' : `${winner.tiles} tiles · ${winner.mana} ✦ Mana`}</div>
    </div>
    <div class="standings-list">${rows}</div>
    <div style="padding:24px 16px 48px;text-align:center;color:var(--muted);font-size:12px">Game over — check the board for final results!</div>`;
}

// ─── Help overlay ────────────────────────────────────────────────────────────
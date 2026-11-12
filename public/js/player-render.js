// player-render.js: split from the inline page script (L2). Loaded in order by player.html; all files share one global scope.
// ─── MAIN RENDER ROUTER ─────────────────────────────────────────────────────
function render() {
  if (window.SGNews) SGNews.setContext(!G || myIdx === null || G.phase === 'lobby' ? 'lobby' : 'game');   // v0.5.41: news banner on join + lobby only
  if (_leftGame) { renderLeftGame(); return; }
  if (!G) { renderConnecting(); return; }
  if (myIdx === null) { renderJoin(); return; }

  // If we're joined but haven't seen our player in the array yet
  const me = G.players[myIdx];
  if (!me) { renderJoin(); return; }

  const isMyTurn = G.currentPlayer === myIdx;

  document.body.classList.remove('setup-compact');   // v0.5.13: only renderSetup turns this on
  // v0.5.11: each new waiting stretch starts in follow mode
  if (isMyTurn) _ringFollow = true;

  // v0.5.06: shared detail sheet closes itself if the phase/turn moved on underneath it
  if (_ds && _ds.key !== _ds.keyFn()) closeCardDetail();

  // Reset setup instruction flag and panel when a new game returns to lobby
  if (G.phase === 'lobby') { _setupClaimSeen = false; _setupPanelIdx = 0; }

  // Notification intercept — show before any other screen.
  // IMPORTANT: also clear battle-result pending state here. Without this, the following
  // race causes a permanent stall:
  //   1. Player is attacker/defender → _battleResultPending = true (timer fires at t+2400ms)
  //   2. Before they dismiss the battle result, a wildcard notification arrives for them
  //   3. Notification intercepts render (correct — it has priority)
  //   4. Player taps dismiss → server clears notification → broadcast → render() called
  //   5. me.notification = null → passes this check → _battleResultPending still true → return
  //   6. Nothing renders; player is stuck. Tapping the stale notification card loops forever.
  // Clearing the pending flags here lets render() proceed normally after notification dismiss.
  if (me.notification) {
    _battleResultPending = false;
    _battleResultDismissed = true;
    if (_battleResultTimer) { clearTimeout(_battleResultTimer); _battleResultTimer = null; }
    renderNotification(me.notification);
    return;
  }

  // Clear battle result hold when server has moved past battle_result phase —
  // but only if already dismissed (prevents auto-skipping the "Got it" screen)
  if (_battleResultPending && G.phase !== 'resolve:battle_result' && _battleResultDismissed) {
    _battleResultPending = false;
    if (_battleResultTimer) { clearTimeout(_battleResultTimer); _battleResultTimer = null; }
  }

  // Hold battle result screen until player explicitly dismisses it
  if (_battleResultPending) return;

  // Debug: log every phase change to console; play turn-notification sound
  if (render._lastPhase !== G.phase || render._lastPlayer !== G.currentPlayer) {
    console.log(`[SG] phase=${G.phase} currentPlayer=${G.currentPlayer} myIdx=${myIdx} isMyTurn=${isMyTurn}`);
    render._lastPhase = G.phase;
    render._lastPlayer = G.currentPlayer;
  }

  // Eliminated players see a spectator screen for all non-game_over phases
  if (me && me.eliminated && G.phase !== 'game_over') {
    renderEliminated();
    return;
  }

  // Reset elimination warning when turnCount advances to a new turn
  if (G.turnCount !== _elimWarnTurn) {
    _elimWarnSeen = false;
    _elimWarnTurn = G.turnCount;
  }

  // v0.5.36: Wheel results are revealed in sync with the board (sanction:reveal) — no separate overlay

  // v0.5.33: full-screen notice the first time you become Sanctioned (again after each new Sanction)
  // v0.5.39: never mid-battle — wait for the battle (and its result screen) to finish, then a short beat so the board's moment lands first
  if (me.sanctioned && _sanctionNoticeSeen !== me.sanctionedAt && G.phase !== 'game_over') {
    const inBattle = G.phase === 'resolve:battle' || G.phase === 'resolve:battle_result' || _battleResultPending;
    if (inBattle) _sancHeldByBattle = true;
    else if (_sancHeldByBattle) {
      _sancHeldByBattle = false;
      _sancShowAt = Date.now() + 1600;
      setTimeout(render, 1650);
    }
    if (!inBattle && Date.now() >= _sancShowAt) { renderSanctionNotice(); return; }
  }

  // v0.5.33: a Sanctioned player never sees normal turn screens (shop/roll/landing) — wait instead
  if (me.sanctioned && !String(G.phase).startsWith('sanction:') && !['resolve:battle_result','resolve:round_callout','game_over','lobby'].includes(G.phase)) {
    renderWaiting();
    return;
  }

  switch (G.phase) {
    case 'lobby':     renderLobby(); break;
    case 'sanction:pick_tile': isMyTurn ? renderSanctionPick() : renderWaiting(); break;   // v0.5.33
    case 'sanction:own':       isMyTurn ? (_sxBoardWaiting() ? renderSanctionWatch('choose') : renderSanctionOwn())  : renderWaiting(); break;
    case 'sanction:omen':      isMyTurn ? (_sxBoardWaiting() ? renderSanctionWatch('choose') : renderSanctionOmen()) : renderWaiting(); break;
    case 'sanction:reveal':    isMyTurn ? renderSanctionWatch('reveal') : renderWaiting(); break;
    case 'setup':     G.autoSetupRunning ? renderSetupWaiting() : !_setupClaimSeen ? renderSetupInstructions(isMyTurn) : (isMyTurn ? renderSetup() : renderSetupWaiting()); break;
    case 'shop': {
      // Show elimination warning if player starts their turn with 0 tiles (post-setup)
      const myTileCount = me ? G.board.filter(t => t.ownerId === myIdx).length : 0;
      const pastGrace = (G.round != null ? G.round : Math.floor(G.turnCount / G.players.length) + 1) > 1;   // v0.5.42: real round
      if (isMyTurn && myTileCount === 0 && pastGrace && !_elimWarnSeen) {
        renderEliminationWarning();
      } else {
        isMyTurn ? renderShop() : renderWaiting();
      }
      break;
    }
    case 'roll':           isMyTurn ? renderRoll() : renderWaiting(); break;
    case 'resolve:well':   renderWell(); break;
    case 'resolve:landing': isMyTurn ? renderLandingChoice() : renderWaiting(); break;
    case 'stalemate':
      console.log(`[SG] *** STALEMATE PHASE *** isMyTurn=${isMyTurn} stalemateData=`, G.stalemateData);
      isMyTurn ? renderStalemate() : renderWaiting();
      break;
    case 'resolve:turn_summary': {
      // Wait for board tally animation before showing summary (only if there's a tally to play)
      const hasTally = G.turnSummary?.roundTally?.length > 0;
      // v0.5.50: the server also records tallyDone, and after 8 s the phone stops waiting regardless (board closed, missed signal…)
      if (hasTally && !_tallyComplete && !G.turnSummary.tallyDone && Date.now() - _tallyGateAt < 8000) {
        renderWaiting();
        clearTimeout(window._tallyGateTimer); window._tallyGateTimer = setTimeout(render, Math.max(250, 8000 - (Date.now() - _tallyGateAt)));
        break;
      }
      isMyTurn ? renderTurnSummary() : renderWaiting();
      break;
    }
    case 'resolve:claim':    isMyTurn ? renderClaim() : renderWaiting(); break;
    case 'resolve:battle':        isMyTurn ? renderBattle() : renderWaiting(); break;
    case 'resolve:battle_result': renderBattleResult(); break;
    case 'resolve:own':      isMyTurn ? renderOwn() : renderWaiting(); break;
    case 'resolve:chest':    isMyTurn ? renderChest() : renderWaiting(); break;
    case 'resolve:temple':   isMyTurn ? renderTemple() : renderWaiting(); break;
    case 'resolve:heal_tile':isMyTurn ? renderHealTile() : renderWaiting(); break;
    case 'resolve:wildcard_cards':    isMyTurn ? renderWildCardPick() : renderWaiting(); break;
    case 'resolve:wildcard_reveal':   isMyTurn ? renderWildCardReveal() : renderWaiting(); break;   // v0.5.58
    case 'resolve:wildcard_target':   isMyTurn ? renderWildCardTarget() : renderWaiting(); break;
    case 'resolve:wildcard_coup_tile':isMyTurn ? renderWildCardCoupTile() : renderWaiting(); break;
    case 'resolve:wildcard_coup_summon':isMyTurn ? renderWildCardCoupSummon() : renderWaiting(); break;
    case 'resolve:wildcard_shatter':  isMyTurn ? renderWildCardShatter() : renderWaiting(); break;
    case 'resolve:round_callout': renderRoundCallout(); break;
    case 'game_over': renderGameOver(); break;
    default: renderWaiting();
  }
}

// ─── CONNECTING SCREEN ──────────────────────────────────────────────────────
function renderConnecting() {
  document.getElementById('status-bar').style.display = 'none';
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  const playerUrl = `${location.protocol}//${location.host}/player`;
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;padding:32px">
      <div style="font-size:32px">🎮</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.1em;color:var(--text-lo)">Connecting…</div>
      <div style="font-size:12px;color:var(--text-mute)">Waiting for server</div>
      <div style="margin-top:8px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px">
        <div style="font-size:10px;color:var(--text-mute);letter-spacing:.08em;text-transform:uppercase">Join this game</div>
        <div id="reconnect-qr" style="background:#fff;padding:8px;border-radius:6px"></div>
        <div style="font-size:11px;color:var(--text-dim);word-break:break-all;text-align:center;max-width:220px">${playerUrl}</div>
      </div>
    </div>`;
  try {
    new QRCode(document.getElementById('reconnect-qr'), {
      text: playerUrl, width: 140, height: 140,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch(e) { /* QR lib not loaded yet — URL text still visible */ }
}

// ─── JOIN SCREEN ────────────────────────────────────────────────────────────
function renderJoin() {
  updateStatusBar(false);
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');

  // v0.5.28: hands are randomised server-side — 1 Guardian + 4 random cards from the set's elements
  const starterDefs = {
    A:{title:'The Cabal',        types:['Dark','Undead','Arcane']},
    B:{title:'The Warpack',      types:['Dark','Beast','Undead']},
    C:{title:'The Order',        types:['Light','Arcane','Nature']},
    D:{title:'The Arcane Watch', types:['Arcane']},
    E:{title:'Divine Guard',     types:['Light']},
    F:{title:'Chaos Legion',     types:['Dark']},
    G:{title:'Dead Covenant',    types:['Undead']},
    H:{title:'Ancient Guard',    types:['Nature','Beast']},
  };
  window._starterDefs = starterDefs;
  const keys = Object.keys(starterDefs);
  const starters = `
    <div class="sp-wrap">
      <div class="sp-stage" id="sp-stage">
        ${keys.map(k=>`<div class="sp-pack" data-set="${k}" onclick="spPick('${k}')">
          <img src="/img/packs/pack-${k}.webp" alt="Set ${k} — ${starterDefs[k].title}" onerror="this.parentNode.classList.add('noimg');this.remove()">
          <div class="sp-fallback">${k} — ${starterDefs[k].title}</div>
        </div>`).join('')}
        <button class="sp-arrow prev" aria-label="Previous set" onclick="spStep(-1)">‹</button>
        <button class="sp-arrow next" aria-label="Next set" onclick="spStep(1)">›</button>
      </div>
      <div class="sp-dots">${keys.map(k=>`<button class="sp-dot" data-set="${k}" aria-label="Set ${k}" onclick="spPick('${k}')"></button>`).join('')}</div>
      <div class="sp-info" id="sp-info"></div>
    </div>`;

  const codeHasError = !!joinError;

  document.getElementById('main-content').innerHTML = `
    <div class="join-logo">
      <img class="join-logo-art" src="/img/logos/logo-main.webp" alt="Summoner's Gambit">
      <div class="join-logo-sub">Player Controller &nbsp;·&nbsp; v0.5.62</div>
    </div>
    <div id="sg-news-pill" style="display:flex;justify-content:center"></div>

    <div class="room-code-group">
      <label class="room-code-lbl">Room Code</label>
      <input
        class="room-code-input${codeHasError?' error':''}"
        id="room-code-field"
        type="text"
        inputmode="text"
        placeholder="— — — —"
        maxlength="4"
        autocomplete="off"
        autocapitalize="characters"
        value="${joinCode}"
        oninput="joinCode=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);this.value=joinCode;joinError='';this.classList.remove('error');document.getElementById('join-code-error').textContent=''"
      >
      <div class="room-code-error" id="join-code-error">${joinError}</div>
    </div>

    <div class="screen-section">
      <div class="field-group">
        <label class="field-lbl">Your Name</label>
        <input class="field-input" id="name-field" type="text" placeholder="Enter name" value="${joinName}" oninput="joinName=this.value" maxlength="18">
      </div>
      <div class="field-group">
        <label class="field-lbl">Starter Set</label>
        ${starters}
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0 18px;">
        <input type="checkbox" id="desktop-mode-toggle" style="width:15px;height:15px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;" ${desktopMode?'checked':''} onchange="desktopMode=this.checked">
        <label for="desktop-mode-toggle" style="font-size:12px;color:var(--text-mute);cursor:pointer;letter-spacing:.04em;">Desktop Mode &nbsp;<span style="opacity:.5;font-size:10px;">— board + controls side by side</span></label>
      </div>
      <button class="action-btn primary" style="width:100%;margin-bottom:32px" onclick="doJoin()">Join Game</button>
    </div>`;
  spLayout(); spBindSwipe();
  if (window.SGNews) { SGNews.setContext('lobby'); SGNews.refresh(); }   // v0.5.41
}

// v0.5.31: starter carousel — moves packs by class only (no full re-render), so the slide animates
function spLayout() {
  const defs = window._starterDefs; if (!defs) return;
  const keys = Object.keys(defs), n = keys.length, sel = Math.max(0, keys.indexOf(joinSet));
  document.querySelectorAll('.sp-pack').forEach(el => {
    let d = keys.indexOf(el.dataset.set) - sel;
    if (d > n / 2) d -= n; if (d < -n / 2) d += n;
    el.className = 'sp-pack' + (el.classList.contains('noimg') ? ' noimg' : '') + ' ' + (d === 0 ? 'c0' : d === -1 ? 'l1' : d === 1 ? 'r1' : d < 0 ? 'l2' : 'r2');
  });
  document.querySelectorAll('.sp-dot').forEach(el => el.classList.toggle('on', el.dataset.set === joinSet));
  const v = defs[joinSet], info = document.getElementById('sp-info');
  if (info) info.innerHTML = `<div class="sp-set">SET ${joinSet}</div><div class="sp-name">${v.title}</div>
    <div class="sp-tags">${v.types.map(t=>`<span class="sp-tag" style="background:${TYPE_COLOR[t]}26;color:${TYPE_COLOR[t]};border:1px solid ${TYPE_COLOR[t]}66">${t}</span>`).join('')}</div>
    <div class="sp-note">1 Guardian + 4 random summons${v.types.length===1?' · Mono-Element Mastery':''}</div>`;
}
function spPick(k) { joinSet = k; spLayout(); }
function spStep(dir) { const keys = Object.keys(window._starterDefs); spPick(keys[(keys.indexOf(joinSet) + dir + keys.length) % keys.length]); }
function spBindSwipe() {
  const st = document.getElementById('sp-stage'); if (!st) return; let x0 = null;
  st.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  st.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) spStep(dx < 0 ? 1 : -1); });
}

function doJoin() {
  const codeEl = document.getElementById('room-code-field');
  const nameEl = document.getElementById('name-field');
  if (codeEl) joinCode = codeEl.value.toUpperCase().trim();
  if (nameEl) joinName = nameEl.value.trim() || joinName;
  if (!joinCode || joinCode.length < 4) {
    joinError = 'Enter the 4-character room code';
    renderJoin();
    return;
  }
  joinName = joinName || 'Player';
  try { localStorage.setItem('sg_last_code', joinCode); localStorage.setItem('sg_last_name', joinName); } catch(e){}
  if (desktopMode) setupDesktopLayout(joinCode);
  send('join', { roomCode: joinCode, name: joinName, starterSet: joinSet });
}

function setupDesktopLayout(code) {
  const body = document.body;
  const app = document.getElementById('app');
  const connStatus = document.getElementById('conn-status');

  const wrapper = document.createElement('div');
  wrapper.id = 'desktop-wrapper';
  wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;overflow:hidden;z-index:1;background:var(--bg-deep);';

  const leftPane = document.createElement('div');
  leftPane.style.cssText = 'flex:1;min-width:600px;overflow:hidden;';
  const iframe = document.createElement('iframe');
  iframe.src = `/spectate?room=${code}&embed=true`;
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  leftPane.appendChild(iframe);

  const rightPane = document.createElement('div');
  rightPane.style.cssText = 'width:390px;flex-shrink:0;overflow:hidden;height:100vh;border-left:1px solid rgba(145,132,217,.18);display:flex;flex-direction:column;';

  wrapper.appendChild(leftPane);
  wrapper.appendChild(rightPane);
  body.appendChild(wrapper);

  if (connStatus) connStatus.style.display = 'none';
  rightPane.appendChild(app);
}

// ─── LOBBY (post-join, waiting for start) ───────────────────────────────────
function renderLobby() {
  updateStatusBar(false);
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');

  const me = G.players[myIdx];
  const rows = G.players.map(p => `
    <div class="lobby-player-row${p.idx===myIdx?' you':''}">
      <svg width="20" height="20" viewBox="0 0 20 20">${sigilShape(p.idx,10,10,5,p.color)}</svg>
      <span style="font-size:13px;font-weight:500;color:${p.color}">${p.name}${p.idx===myIdx?' (you)':''}</span>
      <span style="font-size:11px;color:var(--text-mute);margin-left:auto">✓ Ready</span>
    </div>`).join('');

  document.getElementById('main-content').innerHTML = `
    <div style="padding:32px 16px 20px;text-align:center">
      <div style="font-size:32px;margin-bottom:12px">🏰</div>
      <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;letter-spacing:.15em;color:var(--text);margin-bottom:4px">LOBBY</div>
      <div style="font-size:12px;color:var(--text-mute)">Waiting for host to start…</div>
      <div style="font-size:10px;color:var(--text-mute);margin-top:6px;opacity:.5;letter-spacing:.1em">v0.5.62</div>
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;margin-top:10px;color:${G.skipSetup?'var(--accent)':'var(--text-mute)'}">Setup: ${G.skipSetup?'Auto':'Normal'}</div>
    </div>
    <div id="sg-news-pill" style="display:flex;justify-content:center"></div>
    <div class="lobby-players">${rows}</div>
    <div style="padding:16px 20px 24px">
      <div style="background:rgba(145,132,217,.07);border:1px solid rgba(145,132,217,.18);border-radius:10px;padding:16px">
        <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-bottom:10px">Objective</div>
        <div style="font-size:12px;line-height:1.7;color:var(--text-mute)">
          Summon and battle for control of the board. Roll the dice to move, claim tiles by playing cards from your hand, and outmanoeuvre your rivals. The summoner who holds the most tiles when the round limit runs out claims victory, or be the last one standing.
        </div>
      </div>
    </div>`;
  if (window.SGNews) SGNews.refresh();   // v0.5.41
}

// ─── WAITING SCREEN ──────────────────────────────────────────────────────────
// ─── TURN SUMMARY ────────────────────────────────────────────────────────────
// ─── TURN SUMMARY (v0.5.38) ──────────────────────────────────────────────────
// One long scroll: Since your last turn → Your Summons → Income.
// Summons, HP, Omens and Fortune are read live from the board, so the recall sheet (header button) stays current.
const _TS_BEATS = { Light:'Undead', Dark:'Beast', Arcane:'Dark', Undead:'Arcane', Beast:'Nature', Nature:'Light' };
const _tsLbl = (t) => `<div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.14em;color:#a5a3b8;">${t}</div>`;
const _tsChip = (txt, bg, fg) => `<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${bg};color:${fg};white-space:nowrap;">${txt}</span>`;
const _tsChipCol = {
  bad:  ['rgba(224,90,90,.16)', '#ff9ea2'],
  good: ['rgba(201,168,76,.16)', '#f0d38f'],
  heal: ['rgba(76,175,130,.14)', '#8fe0b0'],
  acc:  ['rgba(145,132,217,.18)', '#c3b8f5'],
};
function _tsPlayerName(i) { const p = G && G.players[i]; return p ? `<b style="color:${p.color || 'var(--text)'}">${p.name}</b>` : 'someone'; }

function _tsSinceHTML(ts) {
  const items = [];
  const card = (img, bad, title, sub) => `<div style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:8px;
      background:${bad ? 'rgba(224,90,90,.08)' : 'rgba(201,168,76,.08)'};border:1px solid ${bad ? 'rgba(224,90,90,.4)' : 'rgba(201,168,76,.4)'};">
      ${img ? `<img src="${img}" alt="" style="width:26px;height:46px;object-fit:cover;border-radius:3px;flex-shrink:0">` : ''}
      <div style="font-size:13px;line-height:1.4;min-width:0;">${title}<br><span style="color:#a5a3b8;font-size:12px;">${sub}</span></div></div>`;
  // Omens standing on my tiles right now
  for (const t of G.board) {
    const o = t.omen;
    if (t.ownerId !== myIdx || !o || !OMEN_INFO[o.id] || !t.summon) continue;
    const info = OMEN_INFO[o.id], bad = info.kind === 'curse';
    items.push(card(omenImg(o.id), bad,
      `<b style="color:${bad ? '#ff9ea2' : '#f0d38f'}">${info.name}</b> on ${t.summon.name} (Tile ${t.pos}) · from ${_tsPlayerName(o.byIdx)}`,
      `${info.desc} · ends on ${G.players[o.byIdx] ? G.players[o.byIdx].name : 'their'}'s next turn`));
  }
  // Omens spent at this income
  for (const u of (ts.omensUsed || [])) {
    const info = OMEN_INFO[u.id]; if (!info) continue;
    const bad = u.id === 'hollow_hunger';
    items.push(card(omenImg(u.id), bad,
      `<b style="color:${bad ? '#ff9ea2' : '#f0d38f'}">${info.name}</b> on ${u.summonName} (Tile ${u.pos}) · from ${_tsPlayerName(u.byIdx)}`,
      bad ? 'Its Gen was 0 this income · now used up' : `Its Gen was doubled (+${u.gen}✦) · now used up`));
  }
  // Wild Cards affecting me this turn
  const wcBad = { stumble:1, delay:1, rattle:1, jinx:1, levy:1 };   // v0.5.60: + Levy
  for (const e of (ts.activeWcEffects || [])) {
    items.push(card(`/img/wildcards/wc-${String(e.id).replace(/_/g,"-")}.png`, !!wcBad[e.id], `<b style="color:${wcBad[e.id] ? '#ff9ea2' : '#f0d38f'}">${e.label}</b> · Wild Card`, e.desc));
  }
  if (!items.length) return '';
  return `<div style="display:flex;flex-direction:column;gap:6px;">${_tsLbl('SINCE YOUR LAST TURN')}${items.join('')}</div>`;
}

function _tsSummonRow(m, t, ts, stationed) {
  const gain = Math.min(Math.max(0, (ts.hpGain && ts.hpGain[m.iid]) || 0), m.hp);
  const before = m.hp - gain;
  const pct = m.hp / m.maxHp;
  const col = pct > .6 ? '#5cc795' : pct > .3 ? '#d8b85e' : '#ef7a7a';
  const hpTxt = `<span style="font-size:14px;color:${col};font-variant-numeric:tabular-nums;white-space:nowrap;">${gain ? `${before}<span>+${gain}</span>` : m.hp}/${m.maxHp}</span>`;
  if (!stationed) {
    return `<div style="display:flex;justify-content:space-between;font-size:13px;"><span>${m.name}</span>${hpTxt.replace('font-size:14px', 'font-size:13px')}</div>`;
  }
  const g = ts.genByIid ? ts.genByIid[m.iid] : undefined;
  const genTxt = g === undefined ? `+${m.gen || 0}✦ Gen <span style="color:#a5a3b8">(next income)</span>` : `${g < 0 ? '−' : '+'}${Math.abs(g)}✦ Gen`;
  // modifiers
  const chips = []; let cursed = false;
  const o = t.omen && OMEN_INFO[t.omen.id];
  if (o) { const c = o.kind === 'curse'; cursed = cursed || c; chips.push(_tsChip(`${o.name}: ${o.desc.replace(/ on this tile$/, '')}`, ..._tsChipCol[c ? 'bad' : 'good'])); }
  if (t.fortune && FORTUNE_INFO[t.fortune]) { const c = t.fortune < 0; cursed = cursed || c; chips.push(_tsChip(`Fortune: ${FORTUNE_INFO[t.fortune].name}`, ..._tsChipCol[c ? 'bad' : 'good'])); }
  if ((G.bonusRuns || []).some(r => r.playerIdx === myIdx && r.tiles.includes(t.pos))) chips.push(_tsChip('Synergy', ..._tsChipCol.acc));
  if (_TS_BEATS[m.type] !== undefined || m.type2) {
    if (t.element === m.type || (m.type2 && t.element === m.type2)) chips.push(_tsChip('Home +15% ATK & DEF', ..._tsChipCol.heal));   // v0.5.43
    else if (!m.type2 && _TS_BEATS[t.element] === m.type) chips.push(_tsChip('Off-element −15% DEF', ..._tsChipCol.bad));
  }
  if (m.charm) chips.push(_tsChip('Battle Charm +25%', ..._tsChipCol.good));
  const w1 = Math.round(before / m.maxHp * 1000) / 10, w2 = Math.round(gain / m.maxHp * 1000) / 10;
  return `<div style="display:flex;flex-direction:column;gap:5px;${cursed ? 'padding:8px;margin:0 -8px;border-radius:8px;background:rgba(224,90,90,.07);' : ''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div style="min-width:0;"><div style="font-size:14px;font-weight:600;">${m.name}</div>
        <div style="font-size:12px;color:#a5a3b8;">Tile ${t.pos} · <span style="color:#c99a55;">${genTxt}</span></div></div>${hpTxt}</div>
    <div style="height:5px;background:#2a2d4a;border-radius:3px;display:flex;overflow:hidden;">
      <div style="width:${w1}%;background:${col};"></div><div style="width:${w2}%;background:${col};opacity:.4;"></div></div>
    ${chips.length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;">${chips.join('')}</div>` : ''}
  </div>`;
}

function _tsSummonsHTML(ts) {
  const mine = G.board.filter(t => t.ownerId === myIdx && t.summon);
  // player-wide passives
  const pc = [];
  if ((ts.medicHeal || 0) > 0) pc.push(_tsChip(`Field Medic: +${ts.medicHeal} HP each`, ..._tsChipCol.heal));
  if ((ts.auraHeal || 0) > 0) pc.push(_tsChip(`Aura of Renewal: +${ts.auraHeal} HP each`, ..._tsChipCol.heal));
  if ((ts.forgeCount || 0) > 0) pc.push(_tsChip(`Forge: +${ts.forgeCount * 5} DEF stationed`, ..._tsChipCol.good));
  if ((ts.weaponSmithCount || 0) > 0) pc.push(_tsChip(`Weapon Smith: +${ts.weaponSmithCount * 5} ATK attacking`, ..._tsChipCol.good));
  if ((ts.manaRefineryBonus || 0) > 0) pc.push(_tsChip(`Mana Refinery: +${ts.manaRefineryBonus}✦`, ..._tsChipCol.good));
  if ((G.monoElementBonus || []).some(r => r.playerIdx === myIdx)) pc.push(_tsChip('Mono Mastery: +20% counter, +1 HP', ..._tsChipCol.acc));
  let genTotal = 0;
  for (const t of mine) { const g = ts.genByIid ? ts.genByIid[t.summon.iid] : undefined; genTotal += g === undefined ? 0 : g; }
  const rows = mine.map(t => _tsSummonRow(t.summon, t, ts, true)).join('');
  const hand = myHand.map(m => _tsSummonRow(m, null, ts, false)).join('');
  return `<div style="background:#151627;border:1px solid #2a2d4a;border-top:2px solid #9184d9;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;justify-content:space-between;border-bottom:1px solid #2a2d4a;padding-bottom:4px;">${_tsLbl('YOUR SUMMONS')}
      <span style="font-size:11px;color:#a5a3b8;">${mine.length} stationed · ${myHand.length} in hand</span></div>
    ${pc.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${pc.join('')}</div>` : ''}
    ${rows || '<div style="font-size:13px;color:#a5a3b8;">Nothing stationed.</div>'}
    ${mine.length ? `<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600;border-top:1px solid #2a2d4a;padding-top:8px;"><span>Gen total</span><span style="color:#c99a55;">${genTotal < 0 ? '−' : '+'}${Math.abs(genTotal)} ✦</span></div>` : ''}
    ${myHand.length ? `<div style="font-size:11px;letter-spacing:.12em;color:#a5a3b8;padding-top:2px;">IN HAND</div>${hand}` : ''}
  </div>`;
}

function _tsIncomeHTML(ts, summonTotal, netMana) {
  const row = (lbl, val, col) => `<div style="display:flex;justify-content:space-between;font-size:14px;"><span>${lbl}</span><span style="color:${col};font-variant-numeric:tabular-nums;">${val}</span></div>`;
  const sgn = (n) => `${n < 0 ? '−' : '+'}${Math.abs(n)} ✦`;
  const G_ = '#c99a55', GR = '#5cc795', R = '#ef7a7a';
  let h = row('Baseline', sgn(ts.baseline), G_);
  if (summonTotal) h += row('Summons', sgn(summonTotal), summonTotal < 0 ? R : G_);
  if (ts.wellBonus > 0) h += row('Mana Well', sgn(ts.wellBonus), GR);
  const bw = ts.battleManaGain || 0, bl = ts.battleManaLoss || 0;
  if (bw || bl) {
    const n = bw - bl, detail = bw && bl ? ` <span style="color:#a5a3b8;font-size:12px;">(+${bw} won, −${bl} lost)</span>` : '';
    h += row(`Battles${detail}`, sgn(n), n < 0 ? R : GR);
  }
  if (ts.upkeep > 0) h += row(`Upkeep (${ts.tileCount} tile${ts.tileCount !== 1 ? 's' : ''})`, sgn(-ts.upkeep), R);
  if (ts.intimidateLoss > 0) h += row('Red Dragon Intimidate', sgn(-ts.intimidateLoss), R);
  if (ts.jinxActive) h += row('Jinx <span style="color:#a5a3b8;font-size:12px;">(income ½)</span>', 'applied', R);
  if (ts.windfallActive) h += row('Windfall <span style="color:#a5a3b8;font-size:12px;">(income ×3)</span>', 'applied', GR);
  if (ts.softCapped) h += row('Soft cap <span style="color:#a5a3b8;font-size:12px;">(150✦+, income ½)</span>', 'applied', R);
  const nc = netMana >= 0 ? GR : R;
  return `<div style="background:#151627;border:1px solid #2a2d4a;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;">
    <div style="border-bottom:1px solid #2a2d4a;padding-bottom:4px;">${_tsLbl('INCOME')}</div>${h}
    <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;border-top:1px solid #2a2d4a;padding-top:8px;margin-top:2px;color:${nc};"><span>Net</span><span>${sgn(netMana)}</span></div>
  </div>`;
}

// recall = opened later from the header button (no Begin Turn; summons live)
function buildTurnSummaryHTML(ts, recall) {
  const tally = ts.roundTally || [];
  const summonTotal = tally.length ? tally.reduce((s, e) => s + e.netMana, 0) : (ts.summonGen || 0) + (ts.manaRefineryBonus || 0);
  const netMana = (ts.baseline + summonTotal + ts.wellBonus + (ts.battleManaGain || 0)) - ts.intimidateLoss - ts.upkeep - (ts.battleManaLoss || 0);
  const roundsRemLabel = ts.roundsRemaining === 1 ? '1 LEFT' : `${ts.roundsRemaining} LEFT`;
  return `<div style="padding:14px 16px ${recall ? '24px' : '120px'};display:flex;flex-direction:column;gap:14px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:4px 2px;">
      <div><div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.12em;color:#a5a3b8;">ROUND ${ts.round} OF ${ts.roundLimit} · ${roundsRemLabel}</div>
        <div style="font-family:'Cinzel',serif;font-size:22px;font-weight:700;margin-top:2px;">${recall ? 'Turn Summary' : 'Your Turn'}</div></div>
      <div style="text-align:right;"><div style="font-family:'Cinzel',serif;font-size:30px;font-weight:700;color:#b0a6ec;line-height:1;">${ts.manaAfter} ✦</div>
        <div style="font-size:13px;font-weight:600;color:${netMana >= 0 ? '#5cc795' : '#ef7a7a'};margin-top:4px;">${netMana >= 0 ? '+' : '−'}${Math.abs(netMana)} this turn</div></div>
    </div>
    ${_tsSinceHTML(ts)}
    ${_tsSummonsHTML(ts)}
    ${_tsIncomeHTML(ts, summonTotal, netMana)}
    ${recall ? '' : `<div style="font-size:12px;color:#a5a3b8;text-align:center;">Reopen this any time until your next turn from the summary button at the top.</div>`}
  </div>`;
}

function renderTurnSummary() {
  const ts = G.turnSummary;
  if (!ts) { renderWaiting(); return; }
  // Play Player-turn stinger once when THIS player's summary first renders (active player only)
  const _tsKey = `${G.turnCount}-${G.currentPlayer}`; // v0.5.05: key on turn, not object ref (new object every broadcast)
  playSoundOnce('turnSummary', _tsKey, '/audio/Player-turn.mp3');

  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('action-bar').classList.remove('visible');
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('main-content').innerHTML = buildTurnSummaryHTML(ts, false);

  // BEGIN TURN button pinned at bottom
  const ab = document.getElementById('action-bar');
  ab.innerHTML = `<button class="btn-primary" style="width:100%;font-family:'Cinzel',serif;font-size:16px;letter-spacing:.08em;padding:18px;" onclick="send('dismiss_turn_summary')">⚔️ BEGIN TURN</button>`;
  ab.classList.add('visible');
}

// v0.5.38: recall sheet — own phone only, until this player's next summary
let mySummary = null;
function _summaryRecallAvailable() {
  const me = G && myIdx !== null ? G.players[myIdx] : null;
  return !!(mySummary && me && !me.sanctioned && !me.eliminated && G.phase !== 'game_over' &&
            !(G.phase === 'resolve:turn_summary' && G.currentPlayer === myIdx));
}
function openSummaryRecall() {
  if (!_summaryRecallAvailable()) return;
  let ov = document.getElementById('ts-recall');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ts-recall';
    ov.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(5,6,12,.72);display:flex;flex-direction:column;justify-content:flex-end;';
    ov.onclick = (e) => { if (e.target === ov) closeSummaryRecall(); };
    document.body.appendChild(ov);
  }
  _refreshSummaryRecall();
}
function _refreshSummaryRecall() {
  const ov = document.getElementById('ts-recall');
  if (!ov) return;
  if (!_summaryRecallAvailable()) { closeSummaryRecall(); return; }
  const sc = ov.querySelector('.tsr-scroll'), top = sc ? sc.scrollTop : 0;
  ov.innerHTML = `<div role="dialog" aria-label="Turn summary" style="max-height:88vh;display:flex;flex-direction:column;background:#0d0e1a;border-top:1px solid #9184d9;border-radius:18px 18px 0 0;color:#e8e6f0;">
      <div style="width:44px;height:5px;border-radius:3px;background:#3a3d52;margin:10px auto 0;flex-shrink:0;"></div>
      <div class="tsr-scroll" style="overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;">${buildTurnSummaryHTML(mySummary, true)}</div>
      <div style="padding:10px 16px 16px;flex-shrink:0;"><button class="btn-primary" style="width:100%;min-height:52px;font-family:'Cinzel',serif;letter-spacing:.08em;" onclick="closeSummaryRecall()">Close</button></div>
    </div>`;
  const sc2 = ov.querySelector('.tsr-scroll'); if (sc2) sc2.scrollTop = top;
}
function closeSummaryRecall() { const ov = document.getElementById('ts-recall'); if (ov) ov.remove(); }

// v0.5.38: Omen notice — the tile owner's phone, after the board's reveal
function renderOmenNotification(n) {
  updateStatusBar(false);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');
  const bad = n.omenKind === 'curse';
  const col = bad ? '#e0565b' : '#e0c07a', soft = bad ? '#ff9ea2' : '#f0d38f';
  const extra = [
    n.healed ? `Healed ${n.healed} HP.` : '',
    n.replaced ? `Replaces ${n.replaced}.` : '',
  ].filter(Boolean).join(' ');
  document.getElementById('main-content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding:22px 20px 28px;gap:14px;text-align:center">
      <div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--text-mute);font-family:'Cinzel',serif">Omen · ${bad ? 'Curse' : 'Blessing'}</div>
      <div style="font-size:13px;color:var(--text-mute)">Placed by <span style="color:${n.castByColor || col};font-weight:700">${n.castByName}</span> <span style="color:#e0565b">⛓ Sanctioned</span></div>
      <div onclick="_dismissNotif()" style="position:relative;width:160px;height:282px;border-radius:12px;border:2px solid ${col};overflow:hidden;cursor:pointer;
           box-shadow:0 0 28px ${col}77,0 4px 24px rgba(0,0,0,.5);flex-shrink:0;background:#14101a;-webkit-tap-highlight-color:transparent">
        <img src="${omenImg(n.cardId)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(8,8,18,.96) 55%,transparent);padding:12px 10px 12px">
          <div style="font-size:14px;font-family:'Cinzel',serif;font-weight:700;color:${soft};margin-bottom:3px">${n.cardName}</div>
          <div style="font-size:9px;letter-spacing:.14em;color:${col};text-transform:uppercase">${bad ? 'Curse' : 'Blessing'}</div>
        </div>
      </div>
      <div style="font-size:15px;line-height:1.5;color:var(--text);max-width:300px">${n.cardDesc}${extra ? `<br><span style="font-size:13px;color:var(--text-mute)">${extra}</span>` : ''}</div>
      <div style="width:100%;max-width:300px;box-sizing:border-box;padding:12px 14px;border-radius:10px;background:var(--surface);border:1px solid ${col}55;text-align:left">
        <div style="font-weight:600;font-size:14px">Tile ${n.pos} · ${n.summonName}</div>
        <div style="font-size:12px;color:var(--text-mute)">${n.summonHp}/${n.summonMaxHp} HP</div>
      </div>
      <div style="font-size:12px;color:var(--text-mute);max-width:300px">Lasts until ${n.castByName}'s next Sanction turn. You'll also see it in your turn summary.</div>
      <button id="notif-dismiss-btn" onclick="_dismissNotif()"
        style="width:100%;max-width:300px;min-height:52px;border-radius:12px;border:1px solid ${col};background:linear-gradient(135deg,${col}38,${col}14);color:var(--text);
               font-family:'Cinzel',serif;font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent">Dismiss</button>
    </div>`;
}

// ─── TILE CAROUSEL HELPERS ───────────────────────────────────────────────────

// Build a 3-tile carousel HTML string.
// centerIdx: which board tile is in the center.
// moveFn: global fn name to call with +1/-1 (string, no parens).
// tapFn: global fn name to call with tilePos when center tapped (string).
function buildTileCarousel(centerIdx, moveFn, tapFn) {
  const total = G.board.length;
  const slots = [
    { pos: (centerIdx - 1 + total) % total, cls: 'side' },
    { pos: centerIdx,                         cls: 'center' },
    { pos: (centerIdx + 1) % total,           cls: 'side' },
  ];

  const slotHtml = slots.map(({ pos, cls }) => {
    const tile = G.board[pos];
    const elColor = tile.element ? (TYPE_COLOR[tile.element] || '#888') : '#888';
    const tileImgSrc = TILE_IMG[tile.element] || TILE_IMG[tile.kind] || '';
    const artStyle = tileImgSrc
      ? `background:url('${tileImgSrc}') center/cover no-repeat;`
      : `background:linear-gradient(160deg,${elColor}33 0%,${elColor}11 100%);`;

    let summonMiniHtml = '';
    if (tile.summon) {
      const m = tile.summon;
      const isSupM = m.rarity === 'support';
      const typeCol = isSupM ? '#9aabbc' : (TYPE_COLOR[m.type] || '#9184d9');
      const typeLabel = isSupM ? 'Support' : (m.type || 'Neutral');
      const typePill = `<div class="wc-type-pill" style="color:${typeCol};border-color:${typeCol}88;background:rgba(0,0,0,.72)">${typeLabel}</div>`;
      summonMiniHtml = `<div class="wc-summon-mini">${renderCard(m, {size:'mini', showCost:false})}${typePill}</div>`;
    }

    let statusHtml = '';
    let monBarHtml = '';
    if (tile.kind !== 'element') {
      const specLabel = tile.kind === 'start' ? '✦ Mana Well' : tile.kind === 'chest' ? '📦 Chest' : tile.kind === 'temple' ? '🏛 Temple' : tile.kind === 'heal' ? '💚 Healing' : tile.label || tile.kind || '';
      statusHtml = `<div class="wc-status special">${specLabel}</div>`;
    } else if (tile.ownerId == null) {
      statusHtml = `<div class="wc-status unclaimed">Unclaimed</div>`;
    } else if (tile.ownerId === myIdx) {
      if (tile.summon) {
        const m = tile.summon;
        const hpPct = Math.max(0, Math.round((m.hp / m.maxHp) * 100));
        const hpCol = hpPct > 60 ? '#4caf7d' : hpPct > 30 ? '#e8a838' : '#e85555';
        monBarHtml = `<div class="wc-mon-bar"><div class="wc-mon-name">${m.name}</div><div class="wc-hp-bar-wrap"><div class="wc-hp-bar" style="width:${hpPct}%;background:${hpCol}"></div></div></div>`;
      }
      statusHtml = `<div class="wc-status own">Your Tile</div>`;
    } else {
      const owner = G.players.find(p => p.idx === tile.ownerId);
      const ownerColor = owner ? owner.color : '#888';
      const ownerName = owner ? owner.name : 'Enemy';
      if (tile.summon) {
        const m = tile.summon;
        const hpPct = Math.max(0, Math.round((m.hp / m.maxHp) * 100));
        const hpCol = hpPct > 60 ? '#4caf7d' : hpPct > 30 ? '#e8a838' : '#e85555';
        monBarHtml = `<div class="wc-mon-bar"><div class="wc-mon-name">${m.name}</div><div class="wc-hp-bar-wrap"><div class="wc-hp-bar" style="width:${hpPct}%;background:${hpCol}"></div></div></div>`;
      }
      statusHtml = `<div class="wc-status enemy" style="color:${ownerColor}">${ownerName}</div>`;
    }

    // Player token badges — show sigils of any players standing on this tile
    const playersHere = G.players.filter(p => !p.eliminated && p.position === pos);
    let playerTokensHtml = '';
    if (playersHere.length) {
      const badges = playersHere.map(p => {
        const isMe = p.idx === myIdx;
        const ring = isMe
          ? `box-shadow:0 0 0 2px ${p.color},0 0 8px ${p.color}88;`
          : `box-shadow:0 0 0 1.5px ${p.color}99;`;
        return `<div class="wc-player-badge${isMe?' me':''}" style="background:rgba(0,0,0,.82);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;${ring}">
          <svg width="14" height="14" viewBox="0 0 20 20">${sigilShape(p.idx,10,10,5,p.color)}</svg>
        </div>`;
      }).join('');
      playerTokensHtml = `<div class="wc-player-tokens">${badges}</div>`;
    }

    const elLabel = tile.element || (tile.kind === 'start' ? 'Well' : tile.kind || '');
    return `
      <div class="wc-slot ${cls}">
        <div class="wc-tile-num">${pos}</div>
        <div class="wc-tile-card" style="border-color:${elColor}${cls === 'center' ? '' : '66'};" onclick="${tapFn}(${pos})">
          <div class="wc-tile-card-bg" style="${artStyle}"></div>
          ${playerTokensHtml}
          ${summonMiniHtml}
          <div class="wc-el-label" style="color:${elColor}">${elLabel}</div>
        </div>
        ${monBarHtml}
        ${statusHtml}
      </div>`;
  }).join('');

  return `
    <div class="wc-carousel">
      <div class="wc-arrow" onclick="${moveFn}(-1)">‹</div>
      <div class="wc-slots">${slotHtml}</div>
      <div class="wc-arrow" onclick="${moveFn}(1)">›</div>
    </div>
    <div class="wc-tap-hint">Tap any tile for details</div>`;
}

// v0.5.07: when _tdCapture is set, openTileDetail returns its sheet HTML instead of opening an overlay
let _tdCapture = null;
function _tdFinish(overlay) {
  if (!_tdCapture) return false;
  const sheet = overlay.querySelector('.tdm-sheet');
  sheet.querySelectorAll('.tdm-close,.tdm-drag').forEach(el => el.remove());
  _tdCapture.html = sheet.innerHTML;
  return true;
}
function _tileDetailBody(tilePos) {
  _tdCapture = {};
  try { openTileDetail(tilePos); } finally {}
  const h = _tdCapture.html || '';
  _tdCapture = null;
  return `<div class="tdm-sheet ds-tile-sheet">${_fortuneBlockHTML(G.board[tilePos])}${_omenBlockHTML(G.board[tilePos])}${h}</div>`;   // v0.5.35 Fortune · v0.5.37 Omen
}
function _tileColor(tilePos) {
  const t = G.board[tilePos];
  if (!t) return 'var(--accent)';
  if (t.kind !== 'element') return ({start:'#4fc3f7',well:'#4fc3f7',chest:'#e8a838',temple:'#9b8dc8',heal:'#4caf7d',healing:'#4caf7d'})[t.kind] || '#888';
  return TYPE_COLOR[t.element] || '#888';
}

// v0.5.10: waiting-screen tile browser — read-only shared sheet over the whole board.
// Stays open while other players act; closes when it becomes your turn (or the game ends).
function openBoardDetail(tilePos) {
  const positions = G.board.map((_, i) => i);
  openDetailSheet(positions, tilePos, null, {
    title: 'Board',
    renderItem: _tileDetailBody,
    colorOf: _tileColor,
    keyFn: () => `board|${G && G.currentPlayer === myIdx}|${G && G.phase === 'game_over'}`,
    onChange: (pos) => {   // keep the ring underneath in sync with what you browsed to
      if (pos !== tilePos) _ringFollow = false;
      if (G.phase === 'setup') _setupCarouselIdx = pos; else _waitCarouselIdx = pos;
    },
    onClose: () => { if (G && G.currentPlayer !== myIdx) setTimeout(render, 0); },
  });
}

function openTileDetail(tilePos) {
  const tile = G.board[tilePos];
  if (!tile) return;

  // --- Special tile branch (chest / temple / heal / well) ---
  if (tile.kind !== 'element') {
    const SPECIAL = {
      start: {
        color:'#4fc3f7', imgKey:'start',
        title:'Mana Well',
        flavor:'An ancient source of power, older than the summoners who fight over it.',
        body:'At the center of the board flows the Mana Well, a convergence of raw arcane energy that has drawn summoners to this arena for generations. Those who stand at its edge feel it immediately: a surge of power flooding through their veins and into their bound summons.',
        callout:'Land here to claim +40 Mana.',
        calloutBody:'No cost. No condition. Just power, freely given to whoever is bold enough to reach it first.',
      },
      chest: {
        color:'#e8a838', imgKey:'chest',
        title:'Treasure Chest',
        flavor:'Not all battles are won with claws and spells.',
        body:'Scattered across the land are ancient caches left behind by summoners long gone. Some contain potions brewed from forgotten recipes. Others hold charms crackling with stored battle energy, scrolls that bend the rules of distance, or creatures bound in stasis, waiting for a new master.',
        callout:'Land here to draw a random reward, resolved immediately.',
        rewards:[
          {pct:'45%', name:'Healing Potion', desc:'Restore HP to one of your stationed summons. Minor (60%) +15 HP / Major (30%) restore 50% of missing HP / Full (10%) full heal.'},
          {pct:'25%', name:'Battle Charm', desc:'Assign to any summon you own. Their next fight deals +25% damage, then the charm is consumed.'},
          {pct:'15%', name:'Warp', desc:'Teleport to a random non-special tile. Or discard and stay put.'},
          {pct:'15%', name:'Free Summon', desc:'A random summon added directly to your hand.'},
        ],
      },
      temple: {
        color:'#9b8dc8', imgKey:'temple',
        title:'The Temple',
        flavor:'Trade mortal power for something greater.',
        body:'The Temple has stood since before the arena was built around it. Scholars argue about who constructed it and why, but summoners care only about what it offers: a direct exchange with forces beyond the ordinary. Bring the right tribute, pay the right price, and something extraordinary answers the call.',
        callout:'Land here to trade a hand summon for an Ascendant.',
        steps:[
          "Your chosen hand summon's element must match the Ascendant.",
          "Pay the Ascendant's Mana cost.",
          "Your traded summon is surrendered permanently.",
        ],
        footer:'Each Ascendant has a special ability condition that must be met before it can be used on the board. Check the card for details.',
      },
      heal: {
        color:'#4caf7d', imgKey:'heal',
        title:'Healing Spring',
        flavor:'The land itself remembers what it is to be whole.',
        body:'There are places in this arena where the ground hums with restorative energy, where wounded summons instinctively pull toward and where even a brief rest can undo hours of punishment. Summoners who discover these springs quickly learn to route their movements through them.',
        callout:'Land here to heal your entire army for 10 Mana.',
        calloutBody:'All stationed summons and all hand summons are healed +10 HP each, up to their max HP. Can be used multiple times in a row. Each use costs 10 Mana. Skip to move on without paying.',
      },
    };
    SPECIAL.well = SPECIAL.start;
    SPECIAL.healing = SPECIAL.heal;

    const cfg = SPECIAL[tile.kind] || { color:'#888', imgKey:tile.kind, title:tile.label || tile.kind, flavor:'', body:'', callout:'' };
    const color = cfg.color;
    const tileImgSrc = TILE_IMG[cfg.imgKey] || TILE_IMG[tile.kind] || '';

    let rewardsHtml = '';
    if (cfg.rewards) {
      rewardsHtml = `<div class="tdm-divider" style="margin:10px 0"></div><div class="tdm-section-lbl" style="padding-left:0">Possible Rewards</div>` +
        cfg.rewards.map(r => `
          <div class="tdm-special-reward-row">
            <div class="tdm-special-pct" style="color:${color}">${r.pct}</div>
            <div>
              <div class="tdm-special-reward-name">${r.name}</div>
              <div class="tdm-special-reward-desc">${r.desc}</div>
            </div>
          </div>`).join('');
    }

    let stepsHtml = '';
    if (cfg.steps) {
      stepsHtml = `<div class="tdm-divider" style="margin:10px 0"></div><div class="tdm-section-lbl" style="padding-left:0">To accept an offer</div>` +
        cfg.steps.map(s => `<div class="tdm-special-step">${s}</div>`).join('');
    }

    const footerHtml = cfg.footer ? `<div class="tdm-special-footer">${cfg.footer}</div>` : '';

    const overlay = document.createElement('div');
    overlay.className = 'tdm-overlay';
    overlay.id = 'tdm-overlay';
    overlay.innerHTML = `
      <div class="tdm-sheet">
        <div class="tdm-drag"></div>
        <div class="tdm-art-banner" style="border-bottom:2px solid ${color}44">
          <img src="${tileImgSrc}" onerror="this.style.display='none'" alt="${cfg.title}" style="object-position:center center">
          <div class="tdm-art-banner-fade"></div>
          <div class="tdm-art-banner-name" style="color:${color}">${cfg.title}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px 0">
          <div style="font-size:11px;color:var(--text-mute)">Tile #${tilePos} · Special</div>
          <div class="tdm-close" onclick="closeTileDetail()">&#x2715;</div>
        </div>
        <div class="tdm-special-body">
          <div class="tdm-special-flavor">${cfg.flavor}</div>
          <div class="tdm-special-para">${cfg.body}</div>
          <div class="tdm-special-callout" style="border-color:${color}44;background:${color}0d">
            <div class="tdm-special-callout-title" style="color:${color}">${cfg.callout}</div>
            ${cfg.calloutBody ? `<div class="tdm-special-callout-body">${cfg.calloutBody}</div>` : ''}
          </div>
          ${rewardsHtml}
          ${stepsHtml}
          ${footerHtml}
        </div>
      </div>`;
    if (_tdFinish(overlay)) return;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeTileDetail(); });
    document.getElementById('app').appendChild(overlay);
    return;
  }

  // --- Elemental tile ---
  const elColor = tile.element ? (TYPE_COLOR[tile.element] || '#888') : '#888';
  const tileImgSrc = TILE_IMG[tile.element] || TILE_IMG[tile.kind] || '';
  const bgStyle = tileImgSrc ? `background:url('${tileImgSrc}') center/cover no-repeat;` : `background:linear-gradient(145deg,${elColor}44,${elColor}11);`;

  // Owner
  let ownerHtml = '';
  if (tile.ownerId != null) {
    const owner = G.players.find(p => p.idx === tile.ownerId);
    const ownerColor = owner ? owner.color : '#888';
    const ownerName = owner ? owner.name : '?';
    const youTag = tile.ownerId === myIdx ? ' <span style="color:#4caf7d;font-size:10px">(you)</span>' : '';
    ownerHtml = `<div class="tdm-owner-row"><svg width="16" height="16" viewBox="0 0 20 20">${sigilShape(tile.ownerId,10,10,5,ownerColor)}</svg><span style="color:${ownerColor};font-weight:600">${ownerName}${youTag}</span></div>`;
  } else if (tile.kind === 'element') {
    ownerHtml = `<div class="tdm-owner-row" style="color:var(--text-mute)">Unclaimed</div>`;
  }

  // Summon detail
  let summonHtml = '';
  if (tile.summon) {
    const m = tile.summon;
    const hpPct = Math.max(0, Math.round((m.hp / m.maxHp) * 100));
    const hpCol = hpPct > 60 ? '#4caf7d' : hpPct > 30 ? '#e8a838' : '#e85555';
    const mTypeCol = TYPE_COLOR[m.type] || '#9184d9';

    // Type matchup
    const strongVs = TYPE_STRONG[m.type] || '—';
    const weakTo = TYPE_WEAK[m.type] || '—';
    const strongCol = TYPE_COLOR[strongVs] || '#888';
    const weakCol = TYPE_COLOR[weakTo] || '#888';

    // Ability
    const lore = MONSTER_LORE[m.name] || {};
    const abilityHtml = lore.ability ? `
      <div class="tdm-ability-box">
        <div class="tdm-ability-name">${lore.ability.split('—')[0].trim()}</div>
        <div class="tdm-ability-desc">${lore.ability.includes('—') ? lore.ability.split('—').slice(1).join('—').trim() : lore.ability}</div>
      </div>` : '';

    const artPng = monsterCardSrc(m.id);
    const artGif = monsterAnimSrc(m.id);
    summonHtml = `
      <div class="tdm-art-banner" style="border-bottom:2px solid ${mTypeCol}44">
        <img src="${artGif}" onerror="this.src='${artPng}';this.onerror=function(){this.style.display='none'}" alt="${m.name}">
        <div class="tdm-art-banner-fade"></div>
        <div class="tdm-art-banner-name" style="color:${mTypeCol}">${m.name}</div>
      </div>
      <div class="tdm-section-lbl">Stationed Monster</div>
      <div class="tdm-monster-card-wrap">
        <div class="tdm-stats-grid" style="flex:1">
          <div class="tdm-stat-box"><div class="tdm-stat-val">${m.atk}</div><div class="tdm-stat-lbl">ATK</div></div>
          <div class="tdm-stat-box"><div class="tdm-stat-val">${m.def}</div><div class="tdm-stat-lbl">DEF</div></div>
          <div class="tdm-stat-box"><div class="tdm-stat-val">${m.cost}</div><div class="tdm-stat-lbl">Cost</div></div>
        </div>
      </div>
      <div class="tdm-hp-section">
        <div class="tdm-hp-label"><span>HP</span><span style="font-weight:600;color:${hpCol}">${m.hp} / ${m.maxHp}</span></div>
        <div class="tdm-hp-track"><div class="tdm-hp-fill" style="width:${hpPct}%;background:${hpCol}"></div></div>
      </div>
      <div class="tdm-divider"></div>
      <div class="tdm-section-lbl">Type Matchup · <span style="color:${mTypeCol}">${m.type}</span></div>
      <div class="tdm-type-row">
        <div class="tdm-type-chip" style="background:${strongCol}18;border:1px solid ${strongCol}44">
          <div class="tdm-type-chip-lbl">Strong vs</div>
          <div class="tdm-type-chip-val" style="color:${strongCol}">${strongVs}</div>
        </div>
        <div class="tdm-type-chip" style="background:${weakCol}18;border:1px solid ${weakCol}44">
          <div class="tdm-type-chip-lbl">Weak to</div>
          <div class="tdm-type-chip-val" style="color:${weakCol}">${weakTo}</div>
        </div>
      </div>
      ${abilityHtml ? `<div class="tdm-divider"></div><div class="tdm-section-lbl">Ability</div>${abilityHtml}` : ''}`;
  } else {
    summonHtml = `<div class="tdm-no-summon">No monster stationed on this tile.</div>`;
  }

  const tileKindLabel = tile.kind === 'element' ? tile.element : (tile.label || tile.kind || 'Tile');
  const overlay = document.createElement('div');
  overlay.className = 'tdm-overlay';
  overlay.id = 'tdm-overlay';
  overlay.innerHTML = `
    <div class="tdm-sheet">
      <div class="tdm-drag"></div>
      <div class="tdm-header">
        <div class="tdm-tile-badge" style="border-color:${elColor};${bgStyle}">
          <span style="font-size:13px;text-shadow:0 1px 4px rgba(0,0,0,.9);color:${elColor}">${tilePos}</span>
        </div>
        <div class="tdm-tile-info">
          <div class="tdm-tile-name" style="color:${elColor}">${tileKindLabel}</div>
          <div class="tdm-tile-sub">Tile #${tilePos}</div>
        </div>
        <div class="tdm-close" onclick="closeTileDetail()">✕</div>
      </div>
      <div class="tdm-divider"></div>
      ${ownerHtml}
      ${summonHtml}
    </div>`;
  if (_tdFinish(overlay)) return;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeTileDetail(); });
  document.getElementById('app').appendChild(overlay);
}

function closeTileDetail() {
  const el = document.getElementById('tdm-overlay');
  if (el) el.remove();
}

// ─── WAITING BOARD RING (v0.5.11) ───────────────────────────────────────────
// Whole board as a ring of 28 element-colored tiles around a center tile card.
// Fill = element (unclaimed = soft fill, no outline) · thick outline = owner color ·
// dark center dot = summon stationed · diamond = special tile · player sigils sit just
// outside the ring. Center auto-follows the active player (setup: the newest claim)
// until the viewer browses; the Follow pill resumes it. Tap center card → board sheet.
let _ringFollow = true;
let _ringOwnedSnap = null;      // setup follow: detect the newest claim
const RING = { VB:360, C:180, R:148, TOK:167 };
function _ringAng(i, n) { return (i / n) * Math.PI * 2; }               // tile 0 top, clockwise (matches board)
function _ringPt(i, n, r) { const a = _ringAng(i, n); return [RING.C + r * Math.sin(a), RING.C - r * Math.cos(a)]; }

function _ringFollowTarget(setup) {
  if (!setup) { const cp = G.players[G.currentPlayer]; return cp ? cp.position : null; }
  const owned = G.board.map(t => t.ownerId);
  let target = null;
  if (_ringOwnedSnap) owned.forEach((o, i) => { if (o != null && o !== _ringOwnedSnap[i]) target = i; });
  _ringOwnedSnap = owned;
  return target;
}

function _isFreeTile(i) { const t = G.board[i]; return t && t.kind === 'element' && t.ownerId == null; }
function _nextFreeTile(from, dir) {
  const n = G.board.length;
  for (let k = 1; k <= n; k++) { const i = ((from + dir * k) % n + n) % n; if (_isFreeTile(i)) return i; }
  return from;
}
function buildBoardRing(selIdx, setup, claimMode, noFollowRow) {
  const n = G.board.length, { C, R, TOK } = RING;
  const selTile = G.board[selIdx];
  const selCol = _tileColor(selIdx);
  let svg = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="22"/>`;
  const [ax, ay] = _ringPt(selIdx, n, R - 18), [bx, by] = _ringPt(selIdx, n, R - 34);
  svg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${selCol}" stroke-width="3" stroke-linecap="round"/>`;
  G.board.forEach((t, i) => {
    const [x, y] = _ringPt(i, n, R);
    const c = _tileColor(i);
    if (i === selIdx) svg += `<circle cx="${x}" cy="${y}" r="15.5" fill="none" stroke="#fff" stroke-width="2"/>`;
    if (t.kind !== 'element') {
      svg += `<rect x="${x-9}" y="${y-9}" width="18" height="18" rx="3" transform="rotate(45 ${x} ${y})" fill="${c}" stroke="#0d0e1c" stroke-width="2"/>`;
    } else if (t.ownerId != null) {
      const owner = G.players.find(p => p.idx === t.ownerId);
      svg += `<circle cx="${x}" cy="${y}" r="10.5" fill="${c}" stroke="${owner ? owner.color : '#888'}" stroke-width="3"/>`;
    } else {
      svg += `<circle cx="${x}" cy="${y}" r="10.5" fill="${c}" fill-opacity=".55"/>`;
    }
    if (t.summon) svg += `<circle cx="${x}" cy="${y}" r="3.4" fill="#0d0e1c"/>`;
  });
  // player sigils just outside the ring, fanned when sharing a tile
  const byPos = {};
  G.players.filter(p => !p.eliminated && p.position != null).forEach(p => (byPos[p.position] = byPos[p.position] || []).push(p));
  Object.entries(byPos).forEach(([pos, ps]) => ps.forEach((p, k) => {
    const a = _ringAng(+pos, n) + (k - (ps.length - 1) / 2) * 0.13;
    const x = C + TOK * Math.sin(a), y = C - TOK * Math.cos(a);
    if (p.idx === G.currentPlayer) svg += `<circle cx="${x}" cy="${y}" r="11.5" fill="none" stroke="${p.color}" stroke-opacity=".45" stroke-width="5"/>`;
    svg += `<circle cx="${x}" cy="${y}" r="8.5" fill="#0d0e1c" stroke="${p.color}" stroke-width="1.5"/>`;
    svg += `<g transform="translate(${x-6} ${y-6}) scale(.6)">${sigilShape(p.idx, 10, 10, 5, p.color)}</g>`;
    if (p.idx === myIdx) svg += `<circle cx="${x}" cy="${y}" r="10.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>`;
  }));

  // center card — summon art when stationed, otherwise the tile art
  const m = selTile.summon;
  const tileImg = TILE_IMG[selTile.element] || TILE_IMG[selTile.kind] || '';
  const art = m
    ? `<img src="${monsterCardSrc(m.id)}" alt="${m.name}" onerror="this.style.display='none'">`
    : (tileImg ? `<img src="${tileImg}" alt="" onerror="this.style.display='none'">` : '');
  const here = G.players.filter(p => !p.eliminated && p.position === selIdx);
  const elLabel = selTile.kind !== 'element'
    ? ({start:'Mana Well',well:'Mana Well',chest:'Chest',temple:'Temple',heal:'Healing',healing:'Healing'})[selTile.kind] || selTile.kind
    : selTile.element;
  let cap;
  if (m) {
    const owner = G.players.find(p => p.idx === selTile.ownerId);
    const pct = Math.max(0, Math.min(1, m.hp / m.maxHp));
    const hc = pct > .6 ? '#4caf7d' : pct > .3 ? '#e8a838' : '#e85555';
    cap = `<b>${m.name}</b>${owner ? ` · <span style="color:${owner.color}">${owner.name}</span>` : ''}<span class="br-hp"><i style="width:${Math.round(pct*100)}%;background:${hc}"></i></span>`;
  } else if (selTile.kind !== 'element') cap = `<b>${elLabel}</b><br>Special tile`;
  else if (selTile.ownerId != null) { const o = G.players.find(p => p.idx === selTile.ownerId); cap = `<b style="color:${o?.color}">${o?.name || '?'}</b><br>${selTile.element} tile`; }
  else cap = `<b>Unclaimed</b><br>${selTile.element} tile`;

  if (claimMode) {
    if (_isFreeTile(selIdx)) cap = `<b style="color:#7dd99a">✓ Open tile</b><br>${selTile.element} · pick a summon below`;
    else if (selTile.kind !== 'element') cap = `<b style="color:#e08888">Can't claim</b><br>${elLabel} is a special tile`;
    else { const o = G.players.find(p => p.idx === selTile.ownerId); cap = `<b style="color:#e08888">Can't claim</b><br>Owned by <span style="color:${o?.color}">${o?.name || '?'}</span>`; }
  }
  const cp = G.players[G.currentPlayer];
  const followLbl = _ringFollow ? 'Following' : (setup ? 'Follow claims' : `Follow ${cp ? cp.name : ''}`);
  return `
    ${(claimMode || noFollowRow) ? '' : `<div class="br-follow-row"><button class="br-follow${_ringFollow ? ' on' : ''}" onclick="ringSetFollow(${!_ringFollow})"><span class="br-dot"></span>${followLbl}</button></div>`}
    <div class="br-box" id="br-box">
      <svg class="br-svg" viewBox="0 0 ${RING.VB} ${RING.VB}" aria-label="Board">${svg}</svg>
      <button class="br-arrow l" onclick="ringStep(-1)" aria-label="Previous tile">‹</button>
      <button class="br-arrow r" onclick="ringStep(1)" aria-label="Next tile">›</button>
      <div class="br-center">
        <div class="br-card" style="--c:${selCol}" onclick="openBoardDetail(${selIdx})" role="button" aria-label="Tile details">
          <div class="br-art">${art}</div>
          <div class="br-num">${selIdx}</div>
          <div class="br-who">${here.map(p => `<i style="--p:${p.color}"></i>`).join('')}</div>
          <div class="br-el">${elLabel}</div>
        </div>
        <div class="br-cap">${cap}</div>
      </div>
    </div>
    <div class="br-hint">${claimMode ? 'Tap the ring to pick an open tile · arrows jump to the next one' : 'Tap the ring to look around · tap the card for details'}</div>`;
}

function _ringIsSetup() { return G && G.phase === 'setup'; }
function _ringGetSel() { return _ringIsSetup() ? _setupCarouselIdx : _waitCarouselIdx; }
function _ringSetSel(i) { const n = G.board.length; i = ((i % n) + n) % n; if (_ringIsSetup()) _setupCarouselIdx = i; else _waitCarouselIdx = i; }
function _ringClaimMode() { return _ringIsSetup() && G.currentPlayer === myIdx; }
function _ringRerender() { _ringClaimMode() ? renderSetup() : (_ringIsSetup() ? renderSetupWaiting() : renderWaiting()); }
function ringStep(dir) {
  _ringFollow = false;
  _ringSetSel(_ringClaimMode() ? _nextFreeTile(_ringGetSel(), dir) : _ringGetSel() + dir);
  _uiTick();   // v0.5.40
  _ringRerender();
}
function ringSetFollow(on) {
  _ringFollow = on;
  if (on && !_ringIsSetup()) { const cp = G.players[G.currentPlayer]; if (cp) _ringSetSel(cp.position); }
  _ringRerender();
}
// Forgiving input: anywhere in the ring band picks the nearest tile by angle; drag scrubs.
// v0.5.40: UI tick when a tile is picked on the mini board (tap, drag-scrub or arrows). Small pool so fast scrubs don't cut each other off.
const _uiTickPool = [0, 1, 2].map(() => { const a = new Audio('/audio/ui-tick.mp3'); a.preload = 'auto'; return a; });
let _uiTickI = 0, _uiTickAt = 0;
function _uiTick() {
  const L = _sfxLvl(); if (L <= 0) return;
  const now = performance.now(); if (now - _uiTickAt < 35) return; _uiTickAt = now;
  const a = _uiTickPool[_uiTickI++ % _uiTickPool.length];
  try { a.volume = Math.min(1, 0.6 * L); a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
}
function attachBoardRing() {
  const box = document.getElementById('br-box');
  if (!box) return;
  const n = G.board.length;
  const idxAt = (e) => {
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * RING.VB - RING.C, y = (e.clientY - r.top) / r.height * RING.VB - RING.C;
    const d = Math.hypot(x, y);
    if (d < RING.R - 34 || d > RING.R + 34) return null;
    let a = Math.atan2(x, -y); if (a < 0) a += Math.PI * 2;
    return Math.round(a / (Math.PI * 2) * n) % n;
  };
  let drag = false;
  const pick = (i) => { if (i == null || i === _ringGetSel()) return; _ringFollow = false; _ringSetSel(i); _uiTick(); _ringRerender(); };   // v0.5.40: tick
  box.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.br-card,.br-arrow')) return;
    const i = idxAt(e); if (i == null) return;
    drag = true; try { box.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault(); pick(i);
  });
  box.addEventListener('pointermove', (e) => { if (drag) pick(idxAt(e)); });
  box.addEventListener('pointerup', () => { drag = false; });
  box.addEventListener('pointercancel', () => { drag = false; });
}

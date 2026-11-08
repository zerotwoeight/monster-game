// player-menu-wildcards.js: split from the inline page script (L2). Loaded in order by player.html; all files share one global scope.
// ─── GAME MENU / LEAVE GAME (v0.5.14) ────────────────────────────────────────
let _leftGame = false;
function _canLeave() {
  if (!G || myIdx === null || _leftGame) return false;
  const me = G.players[myIdx];
  return !!me && !me.eliminated && G.phase !== 'lobby' && G.phase !== 'game_over';
}
// Floating ☰ shows only when the status bar (which has its own ☰) is hidden mid-game
function _syncMenuFab(statusBarShown) {
  const fab = document.getElementById('menu-fab');
  // v0.5.16: menu (sound settings) available on every joined screen; Leave item only when _canLeave()
  const avail = !!G && myIdx !== null && !_leftGame && !!G.players[myIdx];
  if (fab) fab.style.display = (!statusBarShown && avail) ? 'flex' : 'none';
}
function openGameMenu() {
  const sheet = document.getElementById('gm-sheet');
  sheet.innerHTML = `
    <div class="gm-title">Menu</div>
    <button class="gm-item" onclick="showAudioSettings()"><span class="gm-ico">🔊</span>Sound Settings</button>
    <button class="gm-item" onclick="closeGameMenu();toggleHelp()"><span class="gm-ico">?</span>How to Play</button>
    ${_canLeave() ? `<button class="gm-item danger" onclick="showLeaveConfirm()"><span class="gm-ico">🏳</span>Leave Game</button>` : ''}
    <button class="gm-item ghost" onclick="closeGameMenu()">Close</button>`;
  _showMenuWheel(true);
  document.getElementById('game-menu').classList.add('visible');
}
// v0.5.55: element wheel quick reference in the empty space above the main menu
function _showMenuWheel(on) {
  const w = document.getElementById('gm-wheel');
  if (!w) return;
  if (on) {
    w.innerHTML = `<div class="gm-wheel-title">Element Wheel</div><div class="help-wheel-wrap" id="gm-wheel-svg"></div>
      <div class="help-wheel-caption">Arrows point at what each element beats: <strong style="color:#e8e4f4">2×</strong> damage.<br>Hit the other way: <strong style="color:#e8e4f4">½×</strong>.</div>`;
    buildHelpWheel('gm-wheel-svg', 250);
    w.style.display = '';
  } else { w.style.display = 'none'; w.innerHTML = ''; }
}
function showAudioSettings() {
  _showMenuWheel(false);
  const row = (key, label, icon) => {
    const v = Math.round((+AUD[key] || 0) * 100), m = AUD[key + 'Mute'];
    return `<div style="margin:2px 0 8px">
      <div style="display:flex;justify-content:space-between;font-family:'Cinzel',serif;font-size:13px;color:var(--text);margin-bottom:6px">
        <span>${icon} ${label}</span><span id="aus-${key}-val" style="color:var(--accent-pale);font-family:Inter,sans-serif">${m ? 'Muted' : v + '%'}</span></div>
      <div style="display:flex;align-items:center;gap:12px">
        <button id="aus-${key}-mute" onclick="_ausMute('${key}')" style="width:48px;height:44px;flex-shrink:0;border-radius:10px;border:1px solid ${m ? 'rgba(224,82,82,.5)' : 'var(--border2)'};background:${m ? 'rgba(224,82,82,.18)' : 'rgba(145,132,217,.12)'};font-size:20px">${m ? '🔇' : '🔊'}</button>
        <input id="aus-${key}" type="range" min="0" max="100" step="5" value="${v}" oninput="_ausSet('${key}',this.value)" style="flex:1;height:36px;accent-color:#9184d9;${m ? 'opacity:.4' : ''}">
      </div></div>`;
  };
  document.getElementById('gm-sheet').innerHTML = `
    <div class="gm-title">Sound Settings</div>
    <div class="gm-warn" style="padding-bottom:2px">Only affects this phone.</div>
    ${row('music', 'Music', '🎵')}
    ${row('sfx', 'Sound Effects', '💥')}
    <button class="gm-item" style="justify-content:center" onclick="_ausTest()">Test Sound</button>
    <button class="gm-item ghost" onclick="openGameMenu()">‹ Back</button>`;
  document.getElementById('game-menu').classList.add('visible');
}
function _ausSet(key, val) {
  AUD[key] = Math.max(0, Math.min(100, +val)) / 100;
  if (AUD[key] > 0) AUD[key + 'Mute'] = false;
  _saveAud(); _applyAudio(); _ausRefresh(key);
}
function _ausMute(key) { AUD[key + 'Mute'] = !AUD[key + 'Mute']; _saveAud(); _applyAudio(); _ausRefresh(key); }
function _ausRefresh(key) {
  const m = AUD[key + 'Mute'];
  const v = document.getElementById(`aus-${key}-val`), b = document.getElementById(`aus-${key}-mute`), r = document.getElementById(`aus-${key}`);
  if (v) v.textContent = m ? 'Muted' : Math.round(AUD[key] * 100) + '%';
  if (b) { b.textContent = m ? '🔇' : '🔊'; b.style.background = m ? 'rgba(224,82,82,.18)' : 'rgba(145,132,217,.12)'; b.style.borderColor = m ? 'rgba(224,82,82,.5)' : ''; }
  if (r) r.style.opacity = m ? '.4' : '';
}
function _applyAudio() {
  const ml = _musicLvl();
  if (typeof _battleAudio !== 'undefined') {
    if (ml <= 0) { _battleAudio.pause(); } else { _battleAudio.volume = BATTLE_MUSIC_BASE * ml; }
  }
}
function _ausTest() { SFX.dieLand(4); }
function closeGameMenu() { document.getElementById('game-menu').classList.remove('visible'); }
function showLeaveConfirm() {
  _showMenuWheel(false);
  document.getElementById('gm-sheet').innerHTML = `
    <div class="gm-title">Leave Game?</div>
    <div class="gm-warn">You'll be <b>out for good</b> and can't rejoin this game.<br>
      Your hand and Mana are discarded. Your stationed summons stay on the board — others will have to fight them for your tiles.</div>
    <button class="gm-item danger-solid" onclick="confirmLeaveGame()">🏳 Leave Game</button>
    <button class="gm-item ghost" onclick="closeGameMenu()">Keep Playing</button>`;
}
function confirmLeaveGame() {
  if (!_canLeave()) { closeGameMenu(); return; }
  closeGameMenu();
  try { closeCardDetail(); } catch(e) {}
  send('leave_game');
}
// v0.5.45 (G3): host nudge — buzz, replay the turn sound, full-screen card
function _showNudge(msg) {
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch(e) {}
  const L = _sfxLvl(); if (L > 0) { try { const a = new Audio('/audio/Player-turn.mp3'); a.volume = L; a.play().catch(()=>{}); } catch(e) {} }
  let ov = document.getElementById('nudge-ov');
  if (ov) ov.remove();
  ov = document.createElement('div'); ov.id = 'nudge-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,7,16,.82);backdrop-filter:blur(3px);';
  const title = msg.yourTurn ? `It's your turn, ${msg.name}!` : `The host is waiting on you`;
  const sub = msg.yourTurn ? 'Everyone is waiting on your move.' : 'Check your screen — you have something to do.';
  ov.innerHTML = `<div style="width:100%;max-width:340px;background:var(--surface,#16172a);border:2px solid var(--gold-glow,#f2c94c);border-radius:18px;padding:26px 22px;text-align:center;box-shadow:0 0 40px rgba(242,201,76,.35);animation:nudgeIn .35s ease-out">
      <div style="font-size:44px;line-height:1;animation:nudgeBell 1s ease-in-out 2">🔔</div>
      <div style="font-family:'Cinzel',serif;font-weight:800;font-size:20px;margin:12px 0 6px;color:var(--text,#fff)">${title}</div>
      <div style="font-size:13px;color:var(--text-dim,#bbb);margin-bottom:18px">${sub}</div>
      <button class="action-btn" style="width:100%" onclick="document.getElementById('nudge-ov').remove()">Got it</button>
    </div>
    <style>@keyframes nudgeIn{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}@keyframes nudgeBell{0%,100%{transform:rotate(0)}20%{transform:rotate(18deg)}40%{transform:rotate(-16deg)}60%{transform:rotate(10deg)}80%{transform:rotate(-6deg)}}</style>`;
  document.body.appendChild(ov);
}
let _removedByHost = false;
function _onLeftGame(removed) {
  _removedByHost = !!removed;
  _leftGame = true;
  mySessionKey = null;
  try { localStorage.removeItem('sg_session_key'); } catch(e){}
  closeGameMenu();
  try { closeCardDetail(); } catch(e) {}
  renderLeftGame();
}
function renderLeftGame() {
  updateStatusBar(false);
  document.getElementById('hand-area').classList.remove('visible');
  document.getElementById('action-bar').classList.remove('visible');
  const mc = document.getElementById('main-content');
  mc.classList.add('no-hand');
  mc.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;gap:16px;text-align:center;">
      <div style="font-size:44px">${_removedByHost ? '🚪' : '🏳'}</div>
      <div style="font-family:'Cinzel',serif;font-size:16px;letter-spacing:.1em;color:var(--accent-pale);text-transform:uppercase;">${_removedByHost ? 'The host removed you' : 'You left the game'}</div>
      <div style="font-size:12px;color:var(--text-mute);max-width:280px;line-height:1.5">${_removedByHost ? 'Your summons stay on the board. The game carries on without you.' : 'Thanks for playing! The game carries on without you.'}</div>
      <button class="gm-item" style="max-width:280px;justify-content:center;margin-top:8px" onclick="location.reload()">Join a New Game</button>
    </div>`;
}

function toggleHelp() {
  const o = document.getElementById('help-overlay');
  const visible = o.classList.toggle('visible');
  if (visible) buildHelpWheel();
}

function buildHelpWheel(targetId, size) {
  const wrap = document.getElementById(targetId || 'help-wheel');
  if (!wrap) return;

  const W = 230, H = 230, cx = 115, cy = 117, R = 76, nr = 24;
  const types = ['Light','Undead','Arcane','Dark','Beast','Nature'];

  // Hexagon positions: clockwise from top
  const angles = [-90,-30,30,90,150,210].map(d => d*Math.PI/180);
  const pos = types.map((t,i) => ({
    x: cx + R*Math.cos(angles[i]),
    y: cy + R*Math.sin(angles[i]),
    t, c: TYPE_COLOR[t]
  }));

  // Arrow markers
  const defs = types.map((t,i) =>
    `<marker id="ha${i}" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto">
       <polygon points="0 0,7 2.5,0 5" fill="${TYPE_COLOR[t]}" opacity=".9"/>
     </marker>`
  ).join('');

  // Arrows: each node → the node it beats
  const arrows = types.map((t,i) => {
    const from = pos[i];
    const to   = pos[types.indexOf(TYPE_STRONG[t])];
    const dx = to.x-from.x, dy = to.y-from.y;
    const len = Math.sqrt(dx*dx+dy*dy);
    const nx = dx/len, ny = dy/len;
    const sx = (from.x + nx*(nr+3)).toFixed(1);
    const sy = (from.y + ny*(nr+3)).toFixed(1);
    const ex = (to.x - nx*(nr+9)).toFixed(1);
    const ey = (to.y - ny*(nr+9)).toFixed(1);
    return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${from.c}" stroke-width="2" opacity=".8" marker-end="url(#ha${i})"/>`;
  }).join('');

  // Nodes — richer fill, slightly larger stroke
  const nodes = pos.map(p => {
    const lx = p.x.toFixed(1), ly = (p.y+3.5).toFixed(1);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${nr}" fill="${p.c}28" stroke="${p.c}" stroke-width="2"/>
            <text x="${lx}" y="${ly}" text-anchor="middle" font-family="Cinzel,serif" font-size="9.5" font-weight="700" fill="${p.c}">${p.t}</text>`;
  }).join('');

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${size||210}" height="${size||210}">
    <defs>${defs}</defs>
    ${arrows}
    ${nodes}
    <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.18)" font-family="Inter,sans-serif">2× clockwise</text>
  </svg>`;
}

// ─── WILD CARD SYSTEM ────────────────────────────────────────────────────────

const TIER_STYLE = {
  low:  { color:'#7a8fa6', label:'Iron',   glow:'rgba(122,143,166,0.3)' },
  mid:  { color:'#9b6fd4', label:'Arcane', glow:'rgba(155,111,212,0.3)' },
  high: { color:'#c9922a', label:'Gilded', glow:'rgba(201,146,42,0.3)'  },
};

const WILD_CARD_ART = {
  mend:    `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="28" r="12" fill="none" stroke="#7a8fa6" stroke-width="2"/><path d="M30 18v20M20 28h20" stroke="#7a8fa6" stroke-width="2.5" stroke-linecap="round"/><path d="M22 42c4-3 12-3 16 0" stroke="#7a8fa6" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  stumble: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 44 L28 24 L38 34 L50 18" stroke="#7a8fa6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 18 L50 18 L50 24" stroke="#7a8fa6" stroke-width="2" stroke-linecap="round"/><path d="M15 50 L50 50" stroke="#7a8fa6" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 3"/></svg>`,
  delay:   `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="12" width="32" height="38" rx="3" stroke="#7a8fa6" stroke-width="2"/><path d="M22 12 L22 8 M38 12 L38 8" stroke="#7a8fa6" stroke-width="2" stroke-linecap="round"/><path d="M20 28 L32 28" stroke="#7a8fa6" stroke-width="2" stroke-linecap="round"/><path d="M20 36 L28 36" stroke="#7a8fa6" stroke-width="2" stroke-linecap="round"/><path d="M36 32 L44 32 M40 28 L40 36" stroke="#7a8fa6" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  jinx:    `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="14" stroke="#7a8fa6" stroke-width="2"/><path d="M24 24 L36 36 M36 24 L24 36" stroke="#7a8fa6" stroke-width="2.5" stroke-linecap="round"/><circle cx="30" cy="30" r="3" fill="#7a8fa6"/></svg>`,
  ambush:  `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 42 L30 12 L42 42" stroke="#9b6fd4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 34 L39 34" stroke="#9b6fd4" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="12" r="3" fill="#9b6fd4"/></svg>`,
  fortify: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 20 L30 12 L45 20 L45 36 C45 44 30 50 30 50 C30 50 15 44 15 36 Z" stroke="#9b6fd4" stroke-width="2" fill="none"/><path d="M30 22 L30 38 M22 30 L38 30" stroke="#9b6fd4" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  rattle:  `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="26" r="13" stroke="#9b6fd4" stroke-width="2"/><circle cx="24" cy="23" r="2.5" fill="#9b6fd4"/><circle cx="36" cy="23" r="2.5" fill="#9b6fd4"/><path d="M24 34 Q30 38 36 34" stroke="#9b6fd4" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M26 39 L24 46 M34 39 L36 46" stroke="#9b6fd4" stroke-width="2" stroke-linecap="round"/><path d="M20 46 L40 46" stroke="#9b6fd4" stroke-width="2" stroke-linecap="round"/></svg>`,
  poach:   `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 40 C20 28 18 22 30 18 C42 22 40 28 40 40 Z" stroke="#9b6fd4" stroke-width="2" fill="none"/><path d="M26 30 L34 24" stroke="#9b6fd4" stroke-width="2.5" stroke-linecap="round"/><path d="M30 18 L30 10" stroke="#9b6fd4" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="8" r="3" fill="#9b6fd4"/></svg>`,
  coup:    `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 42 L46 42" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><path d="M18 42 L18 30 L30 22 L42 30 L42 42" stroke="#c9922a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 14 L30 10 L38 14 L36 22 L24 22 Z" fill="none" stroke="#c9922a" stroke-width="2" stroke-linejoin="round"/><circle cx="30" cy="10" r="2.5" fill="#c9922a"/></svg>`,
  plague:  `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="20" rx="14" ry="10" fill="none" stroke="#c9922a" stroke-width="2"/><path d="M18 24 C14 32 18 44 30 46 C42 44 46 32 42 24" stroke="#c9922a" stroke-width="2" fill="none"/><circle cx="22" cy="36" r="3" fill="none" stroke="#c9922a" stroke-width="1.5"/><circle cx="30" cy="42" r="3" fill="none" stroke="#c9922a" stroke-width="1.5"/><circle cx="38" cy="36" r="3" fill="none" stroke="#c9922a" stroke-width="1.5"/></svg>`,
  windfall:`<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 48 L30 16" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><path d="M30 16 L20 26" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><path d="M30 16 L40 26" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><circle cx="22" cy="38" r="4" fill="none" stroke="#c9922a" stroke-width="1.5"/><circle cx="38" cy="32" r="4" fill="none" stroke="#c9922a" stroke-width="1.5"/><circle cx="30" cy="44" r="3" fill="none" stroke="#c9922a" stroke-width="1.5"/></svg>`,
  shatter: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="4" fill="#c9922a"/><path d="M30 26 L24 12 M30 26 L38 14" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><path d="M34 30 L48 26 M34 30 L46 36" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><path d="M30 34 L34 48 M30 34 L22 46" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/><path d="M26 30 L12 34 M26 30 L14 24" stroke="#c9922a" stroke-width="2" stroke-linecap="round"/></svg>`,
};

let wcRevealCard = null; // holds chosen card during reveal phase

function renderWildCardPick() {
  wcRevealCard = null;
  const drawn = G.wildCardDrawn;
  if (!drawn) { renderWaiting(); return; }
  const me = G.players[myIdx];
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const cards = ['low','mid','high'].map(tier => drawn[tier]);
  let cardsHtml = '';
  for (const card of cards) {
    const ts = TIER_STYLE[card.tier];
    const canAfford = me.mana >= card.cost;
    // Mask card: full-bleed wc-mask-{tier}.png, GIF→PNG→SVG fallback
    const maskPng = `/img/wildcards/wc-mask-${card.tier}.png`;
    const maskGif = `/img/wildcards/wc-mask-${card.tier}.gif`;
    const maskSvg = `<div class="wc-mask-svg" style="background:linear-gradient(160deg,${ts.color}33,${ts.color}11);display:flex;align-items:center;justify-content:center;">
      <span style="font-size:36px;opacity:0.35">🃏</span></div>`;
    cardsHtml += `
    <div class="wc-mask-card${canAfford ? '' : ' wc-disabled'}"
      style="border-color:${ts.color};box-shadow:${canAfford ? `0 0 14px ${ts.glow}` : 'none'}"
      onclick="${canAfford ? `wcPickCard('${card.tier}')` : ''}">
      ${maskSvg}
      <img class="wc-mask-art" src="${maskGif}"
        onerror="this.src='${maskPng}';this.onerror=function(){this.style.display='none'}" alt="">
      <div class="wc-mask-overlay">
        <span class="wc-tier-label" style="color:${ts.color}">${ts.label}</span>
        <span class="wc-cost" style="color:${ts.color}">✦${card.cost}</span>
      </div>
      ${!canAfford ? `<div class="wc-cant-afford">Can't afford</div>` : ''}
    </div>`;
  }

  document.getElementById('main-content').innerHTML = `
    <div class="wc-header">🃏 Wild Card Event</div>
    <div class="wc-sub">You rolled doubles! Choose a card or skip</div>
    <div class="wc-cards">${cardsHtml}</div>
    <button class="action-btn secondary" onclick="doWildCardSkip()" style="margin:16px auto;display:block;min-width:160px">Skip</button>`;
}

function wcPickCard(tier) {
  wcRevealCard = G.wildCardDrawn[tier];
  renderWildCardReveal();
}

function renderWildCardReveal() {
  const card = wcRevealCard;
  if (!card) { renderWildCardPick(); return; }
  const ts = TIER_STYLE[card.tier];
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  // Mask face art
  const maskPng = `/img/wildcards/wc-mask-${card.tier}.png`;
  const maskGif = `/img/wildcards/wc-mask-${card.tier}.gif`;
  const maskSvgFill = `background:linear-gradient(160deg,${ts.color}33,${ts.color}11)`;

  // Wildcard face art — SVG fallback behind PNG
  const wcSvg = WILD_CARD_ART[card.id] || '';
  const wcPng = `/img/wildcards/wc-${card.id}.png`;

  document.getElementById('main-content').innerHTML = `
    <div class="wc-header">🃏 Wild Card</div>
    <div class="wc-sub">Tap the card to reveal</div>
    <div class="wc-reveal-wrap">
      <div class="wc-scene">
        <div class="wc-flipper" id="wc-flipper" onclick="wcDoFlip()">

          <!-- Front face: mask -->
          <div class="wc-face wc-face-front" style="border-color:${ts.color}">
            <div style="position:absolute;inset:0;${maskSvgFill};display:flex;align-items:center;justify-content:center;">
              <span style="font-size:48px;opacity:0.3">🃏</span>
            </div>
            <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
              src="${maskGif}"
              onerror="this.src='${maskPng}';this.onerror=function(){this.style.display='none'}" alt="">
            <div class="wc-face-overlay">
              <div class="wc-face-meta">
                <span class="wc-tier-label" style="color:${ts.color}">${ts.label}</span>
                <span class="wc-cost" style="color:${ts.color}">✦${card.cost}</span>
              </div>
            </div>
          </div>

          <!-- Back face: wildcard -->
          <div class="wc-face wc-face-back" style="border-color:${ts.color}">
            <div style="position:absolute;inset:0;">${wcSvg ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">${wcSvg}</div>` : ''}</div>
            <img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
              src="${wcPng}" onerror="this.style.display='none'" alt="">
            <div class="wc-face-overlay">
              <div class="wc-face-name" style="color:${ts.color}">${card.name}</div>
              <div class="wc-face-meta">
                <span class="wc-tier-label" style="color:${ts.color}">${ts.label}</span>
                <span class="wc-cost" style="color:${ts.color}">✦${card.cost}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="wc-tap-hint" id="wc-tap-hint">Tap to reveal</div>
      <div class="wc-desc-block" id="wc-desc">${card.desc}</div>
      <button class="action-btn" id="wc-use-btn"
        style="display:none;margin-top:14px;min-width:180px"
        onclick="doWildCardSelect('${card.tier}','${card.id}')">Use</button>
    </div>`;
}

function wcDoFlip() {
  const flipper = document.getElementById('wc-flipper');
  if (!flipper || flipper.classList.contains('flipped')) return;
  flipper.classList.add('flipped');
  // after flip settles, reveal description + Use button
  // Use both transitionend AND a setTimeout fallback — transitionend can silently
  // fail to fire (prefers-reduced-motion, interrupted re-render, browser quirk),
  // which would leave the player stuck with no "Use" button and no way to advance.
  let revealed = false;
  function revealCard() {
    if (revealed) return;
    revealed = true;
    const hint = document.getElementById('wc-tap-hint');
    const desc = document.getElementById('wc-desc');
    const btn  = document.getElementById('wc-use-btn');
    if (hint) hint.style.display = 'none';
    if (desc) desc.classList.add('visible');
    if (btn)  btn.style.display = 'block';
  }
  flipper.addEventListener('transitionend', revealCard, { once: true });
  setTimeout(revealCard, 750); // fallback: 650ms animation + 100ms buffer
}

function renderWildCardTarget() {
  const pending = G.wildCardPending;
  if (!pending) { renderWaiting(); return; }
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const cardName = pending.cardId.charAt(0).toUpperCase() + pending.cardId.slice(1);
  let html = `<div class="wc-header">🃏 ${cardName}</div>`;

  if (pending.cardId === 'mend') {
    html += `<div class="wc-sub">Pick a stationed summon to heal +20 HP</div><div class="wc-target-list">`;
    const myTiles = G.board.filter(t => t.ownerId === myIdx && t.summon);
    if (myTiles.length === 0) {
      html += `<div style="color:var(--text-mute);font-size:12px;padding:20px 16px;text-align:center">No stationed summons to heal.</div>`;
    }
    for (const t of myTiles) {
      const m = t.summon;
      const missing = m.maxHp - m.hp;
      const gain = Math.min(20, missing);
      html += `<div class="wc-target-row" onclick="doWildCardTargetTile(${t.pos})">
        Tile ${t.pos} — <strong>${m.name}</strong> (${m.hp}/${m.maxHp} HP) · +${gain} HP
      </div>`;
    }
    html += `</div>`;
    // Safety escape hatch — server now blocks Mend when there are no stationed summons,
    // but if we somehow land here anyway, provide a skip so the game never stalls.
    if (myTiles.length === 0) {
      html += `<button class="action-btn secondary" onclick="send('wildcard_skip')" style="margin:16px auto;display:block;min-width:160px">Skip</button>`;
    }
  } else {
    html += `<div class="wc-sub">Pick a target player</div><div class="wc-target-list">`;
    let validTargets = 0;
    for (const pl of G.players) {
      if (pl.idx === myIdx) continue;
      if (pl.eliminated) continue;
      // Poach: only show players who actually have hand cards
      if (pending.cardId === 'poach' && pl.handSize === 0) continue;
      // Plague: only show players who have stationed summons
      if (pending.cardId === 'plague' && pl.stationedCount === 0) continue;
      // v0.5.49: Jinx / Delay / Stumble do nothing to a Sanctioned player — show them greyed out
      if (['jinx', 'delay', 'stumble'].includes(pending.cardId) && pl.sanctioned) {
        html += `<div class="wc-target-row" style="border-left:3px solid ${pl.color};opacity:.45;cursor:default" aria-disabled="true">
          <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0">${sigilShape(pl.idx,12,12,6,pl.color)}</svg>
          <span style="color:${pl.color};font-weight:600">${pl.name}</span>
          <span style="font-size:11px;color:var(--text-mute);margin-left:auto">⛓ Sanctioned: no effect</span>
        </div>`;
        continue;
      }
      validTargets++;
      html += `<div class="wc-target-row" style="border-left:3px solid ${pl.color}" onclick="doWildCardTargetPlayer(${pl.idx})">
        <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0">${sigilShape(pl.idx,12,12,6,pl.color)}</svg>
        <span style="color:${pl.color};font-weight:600">${pl.name}</span>
        <span style="font-size:11px;color:var(--text-mute);margin-left:auto">${pl.mana}✦ · ${pl.tileCount} tiles</span>
      </div>`;
    }
    if (validTargets === 0) {
      html += `<div style="color:var(--text-mute);font-size:12px;padding:20px 16px;text-align:center">No valid targets available.</div>`;
      html += `</div><button class="action-btn secondary" onclick="send('wildcard_skip')" style="margin:16px auto;display:block;min-width:160px">Skip</button>`;
    } else {
      html += `</div>`;
    }
  }
  document.getElementById('main-content').innerHTML = html;
}

function renderWildCardCoupTile() {
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  // Only show occupied enemy tiles (server also enforces this)
  const enemyTiles = G.board.filter(t => t.ownerId !== null && t.ownerId !== myIdx && t.summon);
  const hasTargets = enemyTiles.length > 0;
  let html = `<div class="wc-header">🃏 Coup</div><div class="wc-sub">Choose an occupied enemy tile to seize (sacrifice one summon from hand)</div><div class="wc-target-list">`;
  if (!hasTargets) {
    html += `<div style="color:var(--text-mute);font-size:12px;padding:20px 16px;text-align:center">No occupied enemy tiles — no valid target.</div>`;
  }
  for (const t of enemyTiles) {
    const owner = G.players[t.ownerId];
    const elem = t.element || t.label || '?';
    html += `<div class="wc-target-row" style="border-left:3px solid ${owner?.color||'#aaa'}" onclick="doWildCardCoupTile(${t.pos})">
      <span style="font-size:11px;color:var(--text-mute)">Tile ${t.pos} · ${elem}</span>
      <span style="margin-left:6px;font-weight:600;color:${owner?.color||'#aaa'}">${owner?.name||'?'}</span>
      <span style="font-size:10px;color:var(--text-mute);margin-left:auto">${t.summon.name} · ${t.summon.hp}HP</span>
    </div>`;
  }
  html += `</div>`;
  if (!hasTargets) {
    html += `<button onclick="doWildCardCoupCancel()" style="margin:12px 20px 4px;width:calc(100% - 40px);padding:14px;background:var(--surface);border:1px solid var(--border2);border-radius:10px;color:#c9922a;font-size:13px;font-family:'Cinzel',serif;cursor:pointer;letter-spacing:.08em;">Cancel Coup (50% Mana Refund)</button>`;
  }
  document.getElementById('main-content').innerHTML = html;
}

function renderWildCardCoupSummon() {
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  document.getElementById('action-bar').classList.remove('visible');

  const tilePos = G.wildCardPending?.tilePos;
  const tile = tilePos !== undefined ? G.board[tilePos] : null;
  const tileInfo = tile ? `Tile ${tilePos} (${tile.element || tile.label || '?'})` : '?';

  let html = `<div class="wc-header">🃏 Coup — Deploy</div><div class="wc-sub">Choose a summon from your hand to station on ${tileInfo}</div>`;
  if (!myHand || myHand.length === 0) {
    html += `
      <div style="color:var(--text-mute);font-size:12px;padding:20px 16px;text-align:center">No summons in hand — the tile is yours but nothing will be stationed on it.</div>
      <button onclick="doWildCardCoupSkipSummon()" style="margin:0 20px;width:calc(100% - 40px);padding:14px;background:var(--surface);border:1px solid var(--border2);border-radius:10px;color:var(--text-mute);font-size:13px;font-family:'Cinzel',serif;cursor:pointer;letter-spacing:.08em;">Claim Tile Without Deploying</button>`;
  } else {
    html += `<div class="picker-scroll"><div class="scroll-inner" style="padding:14px 20px 20px">`;
    for (const m of myHand) {
      html += `<div onclick="doWildCardCoupSummon(${m.iid})">${renderCard(m, {size:'full', showCost:false, onclick:`doWildCardCoupSummon(${m.iid})`})}</div>`;
    }
    html += `</div></div>`;
  }
  document.getElementById('main-content').innerHTML = html;
}

let wcShatterPicks = [];
function renderWildCardShatter() {
  updateStatusBar(true);
  updateHandStrip(false);
  document.getElementById('main-content').classList.add('no-hand');
  const picks = G.wildCardPending?.picks || [];
  const minPicks = G.wildCardPending?.minPicks ?? 2;

  let html = `<div class="wc-header">🃏 Shatter</div><div class="wc-sub">Choose ${minPicks === 1 ? '1 stationed summon' : '2 stationed summons'} to destroy (${picks.length}/${minPicks} selected)</div><div class="wc-target-list">`;
  const stationedTiles = G.board.filter(t => t.summon);
  if (stationedTiles.length === 0) {
    html += `<div style="color:var(--text-mute);font-size:12px;padding:20px 16px;text-align:center">No stationed summons.</div>`;
  }
  for (const t of stationedTiles) {
    const owner = G.players[t.ownerId];
    const isPicked = picks.includes(t.pos);
    html += `<div class="wc-target-row${isPicked ? ' wc-picked' : ''}" style="border-left:3px solid ${owner?.color||'#aaa'};${isPicked ? 'background:rgba(201,146,42,.12);border-color:#c9922a;' : ''}" onclick="${isPicked ? '' : `doWildCardShatter(${t.pos})`}">
      <span style="color:${owner?.color||'#aaa'};font-weight:600">${owner?.name||'?'}</span>
      <span style="margin-left:6px;font-size:11px;color:var(--text-mute)">Tile ${t.pos} · ${t.summon.name} · ${t.summon.hp}HP</span>
      ${isPicked ? '<span style="margin-left:auto;font-size:11px;color:#c9922a">✓ Selected</span>' : ''}
    </div>`;
  }
  html += `</div>`;

  document.getElementById('main-content').innerHTML = html;
  const ab = document.getElementById('action-bar');
  if (picks.length >= minPicks) {
    ab.classList.add('visible');
    ab.innerHTML = `<button class="action-btn gold-btn" style="width:100%" onclick="doWildCardShatterConfirm()">Confirm Shatter</button>`;
  } else {
    ab.classList.remove('visible');
  }
}

function doWildCardSkip() { send('wildcard_skip'); }
function doWildCardSelect(tier, cardId) { send('wildcard_select', { tier, cardId }); }
function doWildCardTargetPlayer(idx) { send('wildcard_target', { targetIdx: idx }); }
function doWildCardTargetTile(pos) { send('wildcard_target', { tilePos: pos }); }
function doWildCardCoupTile(pos) { send('wildcard_coup_tile', { tilePos: pos }); }
function doWildCardCoupSummon(iid) { send('wildcard_coup_summon', { iid }); }
function doWildCardCoupSkipSummon() { send('wildcard_coup_skip_summon', {}); }
function doWildCardCoupCancel() { send('wildcard_coup_cancel', {}); }
function doWildCardShatter(pos) { send('wildcard_shatter', { tilePos: pos }); }
function doWildCardShatterConfirm() {
  const picks = G.wildCardPending?.picks || [];
  const minPicks = G.wildCardPending?.minPicks ?? 2;
  if (picks.length < minPicks) return;
  // Already sent picks to server — server confirms on last pick
  // This button is cosmetic; the last send already triggered completion
}

// ─── Scroll position preservation ───────────────────────────────────────────
function saveScrolls() {
  const map = {};
  document.querySelectorAll('[id]').forEach(el => {
    if (el.scrollLeft > 0) map[el.id] = el.scrollLeft;
  });
  return map;
}
function restoreScrolls(map) {
  for (const [id, left] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.scrollLeft = left;
  }
}

// ─── ACTIONS ────────────────────────────────────────────────────────────────
function selectCard(iid) {
  selectedIid = (selectedIid === iid) ? null : iid;
  // Live preview on board during battle selection
  if (G && G.phase === 'resolve:battle') {
    send('preview_attacker', { iid: selectedIid });
  }
  const scrolls = saveScrolls();
  render();
  restoreScrolls(scrolls);
}

function selectTempleSpecial(iid) {
  selectedIid = (selectedIid === iid) ? null : iid;
  tradeIid = null;
  const scrolls = saveScrolls();
  render();
  restoreScrolls(scrolls);
}

function selectTemplatSacrifice(iid) {
  tradeIid = (tradeIid === iid) ? null : iid;
  const scrolls = saveScrolls();
  render();
  restoreScrolls(scrolls);
}

function doBuy() {
  if (!selectedIid) return;
  SFX.buy();
  send('buy', { iid: selectedIid });
  selectedIid = null;
}

function doSell() {
  if (!selectedIid) return;
  SFX.sell();
  send('sell', { iid: selectedIid });
  selectedIid = null;
}

function doClaim() {
  if (!selectedIid) return;
  SFX.claim();
  send('claim', { iid: selectedIid });
  selectedIid = null;
}

function doRetreat() {
  _stopBattleMusic();
  send('retreat');
}

function doAttack() {
  if (!selectedIid) return;
  SFX.attack();
  send('attack', { iid: selectedIid });
  selectedIid = null;
}

function doStalemateFight() {
  SFX.attack && SFX.attack();
  send('stalemate_fight');
}

function doStalemateContinue() {
  SFX.click && SFX.click();
  send('stalemate_continue');
}

function doSwap() {
  if (!selectedIid) return;
  SFX.claim();
  send('swap', { newSummonIid: selectedIid });
  selectedIid = null;
}

function doHeal() {
  SFX.heal();
  send('heal_stationed');
  selectedIid = null;
}

function doChangeElement(el) {
  SFX.charm();
  send('change_element', { element: el });
  selectedIid = null;
}

function doApplyPotion() {
  if (selectedIid === null) return;
  SFX.potion();
  // selectedIid is the monster's iid (works for both hand and stationed)
  send('chest_apply_potion', { iid: selectedIid });
  selectedIid = null;
}

function doAssignCharm() {
  if (selectedIid === null) return;
  SFX.charm();
  // selectedIid could be an iid (hand) or a tilePos (stationed)
  // Stationed tiles have pos as integer; hand iids are also integers but won't overlap with tile positions in a meaningful way
  // The server handles both: data.iid for hand, data.tilePos for stationed
  const handM = myHand.find(m => m.iid === selectedIid);
  if (handM) {
    send('chest_assign_charm', { iid: selectedIid });
  } else {
    send('chest_assign_charm', { tilePos: selectedIid });
  }
  selectedIid = null;
}

function doHealTile() {
  SFX.heal();
  send('heal_tile_apply', {});
}

function doTempleTrade() {
  if (!selectedIid || !tradeIid) return;
  SFX.temple();
  send('temple_trade', { specialIid: selectedIid, sacrificeIid: tradeIid });
  selectedIid = null;
  tradeIid = null;
}

// ─── INIT ────────────────────────────────────────────────────────────────────
connect();
renderConnecting();

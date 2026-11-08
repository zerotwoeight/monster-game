// player-core.js: split from the inline page script (L2). Loaded in order by player.html; all files share one global scope.

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
const TYPE_WEAK   = {Light:'Nature',Dark:'Arcane',Arcane:'Undead',Undead:'Light',Beast:'Dark',Nature:'Beast'};
const TYPE_ICON   = {Light:'✦',Dark:'◉',Arcane:'✶',Undead:'☠',Beast:'⚔',Nature:'❧'};
const PLAYER_COLORS = ['#e05252','#5ca8e0','#5dc97d','#e0b050','#c07fd8','#60cdc0'];

// ─── AUDIO SETTINGS (v0.5.16) — per-phone, saved in this browser ─────────────
const AUD = (() => {
  const d = { music: 1, sfx: 1, musicMute: false, sfxMute: false };
  try { Object.assign(d, JSON.parse(localStorage.getItem('sg_audio_player') || '{}')); } catch(e) {}
  return d;
})();
function _saveAud() { try { localStorage.setItem('sg_audio_player', JSON.stringify(AUD)); } catch(e) {} }
function _musicLvl() { return AUD.musicMute ? 0 : Math.max(0, Math.min(1, +AUD.music || 0)); }
function _sfxLvl()   { return AUD.sfxMute   ? 0 : Math.max(0, Math.min(1, +AUD.sfx   || 0)); }

// ─── SFX (Web Audio API — procedural, no external files) ────────────────────
const SFX = (() => {
  let _ctx = null;
  function ctx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume().catch(()=>{});
    return _ctx;
  }
  document.addEventListener('click',      () => ctx(), {once:true, capture:true});
  document.addEventListener('touchstart', () => ctx(), {once:true, capture:true});

  function tone(freq, type='sine', vol=0.15, dur=0.12, attack=0.005, rel=0.1, delay=0) {
    const L = _sfxLvl(); if (L <= 0) return; vol = Math.max(0.0012, vol * L);
    try {
      const c = ctx(), now = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = type; o.frequency.setValueAtTime(freq, now + delay);
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(vol, now + delay + attack);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      o.start(now + delay); o.stop(now + delay + dur + 0.02);
    } catch(e){}
  }
  function noise(vol=0.08, dur=0.1, delay=0, hipass=0) {
    const L = _sfxLvl(); if (L <= 0) return; vol = Math.max(0.0012, vol * L);
    try {
      const c = ctx(), now = c.currentTime;
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
      const src = c.createBufferSource(); src.buffer = buf;
      const g = c.createGain();
      if (hipass) {
        const f = c.createBiquadFilter(); f.type='highpass'; f.frequency.value=hipass;
        src.connect(f); f.connect(g);
      } else { src.connect(g); }
      g.connect(c.destination);
      g.gain.setValueAtTime(vol, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      src.start(now + delay); src.stop(now + delay + dur + 0.02);
    } catch(e){}
  }

  return {
    // Die cycling tick — wooden rattle
    dieTick() {
      noise(0.06, 0.035, 0, 800);
      tone(180, 'square', 0.035, 0.035, 0.001, 0.03);
    },
    // Die lands — thud, scales with roll value
    dieLand(val=3) {
      noise(0.18, 0.18);
      tone(55 + val*10, 'sine', 0.28, 0.35, 0.002, 0.32);
      tone(110 + val*18, 'triangle', 0.12, 0.22, 0.002, 0.20);
    },
    // Buy from shop — coin clink
    buy() {
      tone(440, 'sine',  0.12, 0.14, 0.003, 0.12);
      tone(660, 'sine',  0.09, 0.20, 0.003, 0.18, 0.10);
    },
    // Sell — reversed coin
    sell() {
      tone(660, 'sine',  0.10, 0.12, 0.003, 0.10);
      tone(440, 'sine',  0.08, 0.18, 0.003, 0.16, 0.10);
    },
    // Claim tile — place-down thud + chime
    claim() {
      noise(0.08, 0.12, 0, 200);
      tone(480, 'sine',  0.10, 0.18, 0.003, 0.15);
      tone(720, 'sine',  0.065,0.14, 0.002, 0.12, 0.10);
    },
    // Attack — weapon swing
    attack() {
      noise(0.12, 0.18);
      tone(120, 'sawtooth', 0.16, 0.25, 0.002, 0.22);
      tone(240, 'square',   0.08, 0.20, 0.002, 0.18, 0.08);
    },
    // Heal — soft restorative chime
    heal() {
      tone(528,  'sine', 0.13, 0.30, 0.010, 0.28);
      tone(792,  'sine', 0.09, 0.25, 0.008, 0.22, 0.08);
      tone(1056, 'sine', 0.055,0.20, 0.005, 0.18, 0.16);
    },
    // Chest / reward reveal — ascending sparkle
    chest() {
      tone(400,  'sine', 0.10, 0.10, 0.004, 0.09);
      tone(600,  'sine', 0.12, 0.12, 0.004, 0.10, 0.10);
      tone(800,  'sine', 0.14, 0.30, 0.004, 0.27, 0.22);
    },
    // Temple trade — magical exchange
    temple() {
      noise(0.07, 0.20);
      tone(280,  'sine',     0.10, 0.18, 0.010, 0.16);
      tone(420,  'triangle', 0.12, 0.25, 0.008, 0.22, 0.10);
      tone(560,  'sine',     0.09, 0.30, 0.006, 0.27, 0.20);
    },
    // Potion applied
    potion() {
      tone(500,  'sine', 0.12, 0.22, 0.006, 0.20);
      tone(750,  'sine', 0.09, 0.18, 0.005, 0.16, 0.12);
    },
    // Battle charm assigned
    charm() {
      noise(0.05, 0.10);
      tone(360,  'triangle', 0.10, 0.18, 0.004, 0.16);
      tone(540,  'triangle', 0.08, 0.22, 0.004, 0.20, 0.10);
    },
    // Retreat / skip — muted click
    retreat() {
      noise(0.05, 0.08, 0, 400);
      tone(200, 'sine', 0.07, 0.12, 0.003, 0.10);
    },
  };
})();

// ─── LOCAL STATE ───────────────────────────────────────────────────────────
let G = null;         // server game state
let myIdx = null;     // my player index
let myHand = [];      // my hand from server
let selectedIid = null; // currently selected card iid
let tradeIid = null;    // temple sacrifice iid
let setupTileStr = '';
let _setupClaimTurnKey = null; // v0.5.12: open on an empty tile once per setup turn  // typed tile number during setup phase

// Join form values (pre-fill code from last session if available)
let joinCode = (() => { try { return localStorage.getItem('sg_last_code') || ''; } catch(e){ return ''; } })();
let joinName = (() => { try { return localStorage.getItem('sg_last_name') || 'Player'; } catch(e){ return 'Player'; } })();
let joinSet = 'C';
let joinError = '';
let desktopMode = false; // desktop mode — splits view into board iframe (left) + player controls (right)

// Session key for reconnection (persisted to localStorage so refresh auto-rejoins)
let mySessionKey = (() => { try { return localStorage.getItem('sg_session_key') || null; } catch(e){ return null; } })();

// Roll animation state
let rollAnimating = false;
let pendingGameState = null;
let pendingRollValue = null;
let rollShowCallback = null;
let _tallyComplete = false; // gate: player summary waits for board tally_complete signal
let _tallyGateKey = null, _tallyGateAt = 0;   // v0.5.50: which summary the gate belongs to, and when it closed
// v0.5.03: play a sound once per (slot, key) — replaces per-sound _xxxPlayedFor flags
const _soundPlayedFor = {};
function playSoundOnce(slot, key, src) {
  if (_soundPlayedFor[slot] === key) return;
  _soundPlayedFor[slot] = key;
  const L = _sfxLvl(); if (L <= 0) return;
  try { const a = new Audio(src); a.volume = L; a.play().catch(()=>{}); } catch(e) {}
}
let _waitCarouselIdx = 0;  // center tile index for regular waiting screen carousel
let _setupCarouselIdx = 0; // center tile index for setup waiting screen carousel

// ─── WEBSOCKET ─────────────────────────────────────────────────────────────
const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
let ws = null;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    document.getElementById('conn-status').className = 'connected';
    document.getElementById('conn-status').textContent = '●  Live';
    setTimeout(()=>{ const cs=document.getElementById('conn-status'); if (cs.className==='connected') cs.style.opacity='0'; }, 2000); // v0.5.19: hide once live (sat under the ☰ button)
    // Rejoin handled in the 'ready' message handler
  };
  ws.onclose = () => {
    document.getElementById('conn-status').className = 'disconnected';
    document.getElementById('conn-status').textContent = '●  Reconnecting…';
    document.getElementById('conn-status').style.opacity = '1';
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'news') { if (window.SGNews) SGNews.set(msg.news); return; }   // v0.5.41: lobby news
    if (msg.type === 'ready') {
      // Server ready — rejoin if we have a session key, otherwise show join screen
      if (mySessionKey) { send('rejoin', { sessionKey: mySessionKey }); }
      else { renderJoin(); }
      return;
    } else if (msg.type === 'session') {
      mySessionKey = msg.sessionKey;
      try { localStorage.setItem('sg_session_key', mySessionKey); } catch(e){}
    } else if (msg.type === 'nudge') {   // v0.5.45 (G3): host nudge
      _showNudge(msg);
      return;
    } else if (msg.type === 'left_game') {
      _onLeftGame(!!msg.removed);   // v0.5.45: removed by the host
      return;
    } else if (msg.type === 'tally_complete') {
      // Board finished the pre-round tally animation — now show our turn summary
      _tallyComplete = true;
      render();
      return;
    } else if (msg.type === 'state') {
      // v0.5.23 / v0.6.12: a deploy restarted the server with a new version — reload once so this
      // device runs the new code (session key / room code bring it straight back into the game).
      if (msg.game && msg.game.serverVersion) {
        if (window._sgSrv && window._sgSrv !== msg.game.serverVersion) { location.reload(); return; }
        window._sgSrv = msg.game.serverVersion;
      }
      // If we're entering turn_summary with a tally, reset the gate so we wait for tally_complete.
      // v0.5.50: only when a NEW summary starts (round / turn / player change). It used to reset on every update,
      // so an update mid-summary (a notice dismissed) left the phone waiting for a tally that had already finished.
      if (msg.game && msg.game.phase === 'resolve:turn_summary' &&
          msg.game.turnSummary && msg.game.turnSummary.roundTally && msg.game.turnSummary.roundTally.length > 0) {
        const _k = `${msg.game.round}|${msg.game.turnCount}|${msg.game.currentPlayer}`;
        if (_k !== _tallyGateKey) { _tallyGateKey = _k; _tallyComplete = false; _tallyGateAt = Date.now(); }
      }
      if (msg.mySummary !== undefined) mySummary = msg.mySummary;   // v0.5.38
      if (rollAnimating) {
        const ng = msg.game, ni = msg.myIdx !== undefined ? msg.myIdx : myIdx, nh = msg.hand !== undefined ? msg.hand : myHand;
        pendingGameState = { game: ng, myIdx: ni, hand: nh };
        const roller = ng.players[ni];
        const rv = roller != null ? roller.lastDiceRoll : null;
        if (rv != null) {
          if (rollShowCallback) { const cb = rollShowCallback; rollShowCallback = null; cb(rv); }
          else pendingRollValue = rv;
        }
      } else {
        G = msg.game;
        if (msg.myIdx !== undefined) myIdx = msg.myIdx;
        if (msg.hand !== undefined) myHand = msg.hand;
        render();
      }
    } else if (msg.type === 'error') {
      if (msg.message === 'Invalid room code') {
        joinError = 'Invalid room code — check with your host';
        renderJoin();
      } else if (msg.message === 'Session expired — please rejoin') {
        mySessionKey = null;
        try { localStorage.removeItem('sg_session_key'); } catch(e){}
        myIdx = null;
        G = null;
        renderJoin();
      } else {
        showToast('⚠ ' + msg.message);
      }
    }
  };
}

function send(action, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action, ...data }));
  }
}

// ─── SVG ART ───────────────────────────────────────────────────────────────







function artSVG(type, w, h) {
  const c = TYPE_COLOR[type] || '#9184d9';
  const fns = {Light:svgLight,Dark:svgDark,Arcane:svgArcane,Undead:svgUndead,Beast:svgBeast,Nature:svgNature};
  return (fns[type] || svgLight)(c, w, h);
}


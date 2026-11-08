// board-ui-audio.js: split from the inline page script (L2). Loaded in order by board.html; all files share one global scope.
// ─── Scale root to viewport ──────────────────────────────────────────────────────────────────────────
function scaleRoot(root){
  // Use clientWidth/Height: excludes scrollbar gutter and is consistent across
  // browsers even when the meta viewport width=1440 tag affects window.innerWidth.
  const vw = document.documentElement.clientWidth  || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;
  const s = Math.min(vw / 1440, vh / 900);
  root.style.transform = `scale(${s})`;
  // Center horizontally and vertically within viewport
  root.style.left = Math.max(0, (vw - 1440 * s) / 2) + 'px';
  root.style.top  = Math.max(0, (vh - 900  * s) / 2) + 'px';
  document.body.style.background = '#0d0e1c';
}

window.addEventListener('resize', () => {
  const root = document.getElementById('scale-root');
  if (root) scaleRoot(root);
});

// ─── End Game modal ────────────────────────────────────────────────────────────────────────
function showEndGameModal(){
  document.getElementById('end-game-modal').classList.add('visible');
}
function hideEndGameModal(){
  document.getElementById('end-game-modal').classList.remove('visible');
}
function doEndGame(){
  hideEndGameModal();
  if(ws && ws.readyState === WebSocket.OPEN){
    send('end_game');
  }
}

function doNewGame(){
  if(ws && ws.readyState === WebSocket.OPEN){
    send('new_game');
  }
}

// ─── Background Music ───────────────────────────────────────────────────────────────────────
// v0.5.05: _bgMuted now means MUSIC is off (level 0 or muted). SFX use _sfxLvl().
let _bgMuted = _musicLvl() <= 0;
const MUSIC_BASE = 0.15;
function _musicTarget() { return MUSIC_BASE * _musicLvl(); }
// ─── Hit / UI SFX ───────────────────────────────────────────────────────────────────────────
const _sfxTitle      = new Audio('/audio/title-sound.mp3');   _sfxTitle._base      = 0.6;
const _sfxHitSlash   = new Audio('/audio/Hit-Slash.mp3');     _sfxHitSlash._base   = 0.5;
const _sfxHitMagic   = new Audio('/audio/Hit-Magic.mp3');     _sfxHitMagic._base   = 0.5;
const _sfxHitClaw    = new Audio('/audio/Hit-Claw.mp3');      _sfxHitClaw._base    = 0.5;
// v0.6.02: dice-roll.mp3 is a pack of 9 separate roll takes — play one at random, then stop
const _sfxDice = new Audio('/audio/dice-roll.mp3'); _sfxDice._base = 0.7; _sfxDice.preload = 'auto';
const DICE_TAKES = [[0.12,1.0],[1.52,2.2],[3.02,3.7],[4.42,5.1],[5.52,6.15],[6.82,7.55],[8.37,9.1],[9.47,10.25],[10.67,11.3]];
let _diceStopT = null, _diceLast = -1;
function _playDiceRoll() {
  const L = _sfxLvl(); if (L <= 0) return;
  let k; do { k = Math.floor(Math.random() * DICE_TAKES.length); } while (k === _diceLast && DICE_TAKES.length > 1);
  _diceLast = k;
  const [a, b] = DICE_TAKES[k];
  try {
    clearTimeout(_diceStopT);
    _sfxDice.volume = _sfxDice._base * L;
    _sfxDice.currentTime = a;
    _sfxDice.play().catch(() => {});
    _diceStopT = setTimeout(() => { try { _sfxDice.pause(); } catch (e) {} }, (b - a) * 1000 + 120);
  } catch (e) {}
}
function _playSfx(audio) {
  const L = _sfxLvl(); if (L <= 0) return;
  audio.volume = (audio._base || 0.5) * L;
  audio.currentTime = 0; audio.play().catch(() => {});
}

// ─── SUMMON VOICES (v0.6.22, battles v0.6.23) ─────────────────────────────────────────────────
// Server sets G.lastVoice {seq, id, moment} on claim / swap / temple / chest free summon.
// Clips: /audio/voices/<id>_line.mp3 (spoken) or <id>_sfx.mp3 (creature sound). Line wins when both exist.
// Rules: one voice at a time (new stops old) · 3.5 s cooldown per monster · music ducks while it plays.
const VOICE_HAS_LINE = new Set(['ancient_oak','arcane_arbiter','arch_mage','ardent_saint','briar_sprite','cursed_revenant','dawn_striker','dawnguard','death_knight','demon_lord','dusk_blade','field_medic','grave_specter','grove_warden','high_paladin','luminar_operative','mana_weaver','pack_hunter','plague_herald','radiant_lancer','rune_priestess','runic_duelist','shade_walker','shadow_paladin','solar_knight','sorcerer','spell_wraith','succubus','sunfire_herald','thornling','verdant_sorcerer','void_reaper','weapon_smith','world_tree']);   // v0.6.24: Hex Stalker sound-only
const VOICE_HAS_SFX = new Set(['bone_wraith','cursed_revenant','feral_striker','forge','hex_stalker','iron_hide','mana_refinery','moss_golem','nightshard','razorclaw','red_dragon','spell_wraith','stoneback','stormtalon','umbral_stalker','vine_stalker','void_reaper','void_sentinel']);   // v0.6.23: battles prefer the creature sound
const VOICE_COOLDOWN_MS = 3500, VOICE_DUCK = 0.35;
let _voiceCur = null;
const _voiceLast = {};
function _voiceUnduck() { if (_bgMuted) return; const mt = _musicTarget(); _bgAudio.volume = mt; _bgFinal.volume = mt; }
function _voiceStop() { if (_voiceCur) { try { _voiceCur.pause(); } catch (e) {} _voiceCur = null; } _voiceUnduck(); }
function _playVoice(id, moment) {
  const L = _voiceLvl(); if (L <= 0 || !id) return;
  const now = Date.now();
  if (_voiceLast[id] && now - _voiceLast[id] < VOICE_COOLDOWN_MS) return;
  _voiceLast[id] = now;
  if (_voiceCur) { try { _voiceCur.pause(); } catch (e) {} }
  // v0.6.23: battle moments use the sound when a monster has both; everything else prefers the line
  const useSfx = String(moment).startsWith('battle') ? VOICE_HAS_SFX.has(id) : !VOICE_HAS_LINE.has(id);
  const a = new Audio('/audio/voices/' + id + (useSfx ? '_sfx' : '_line') + '.mp3');
  a.volume = Math.min(1, (moment === 'temple' ? 1 : 0.85) * L);
  _voiceCur = a;
  if (!_bgMuted) { const d = _musicTarget() * VOICE_DUCK; _bgAudio.volume = d; _bgFinal.volume = d; }
  const done = () => { if (_voiceCur === a) { _voiceCur = null; _voiceUnduck(); } };
  a.onended = done; a.onerror = done;
  a.play().catch(done);
}
let _bgStarted = false;
const _bgAudio = new Audio('/audio/main-theme.mp3');
_bgAudio.loop = true;
_bgAudio.volume = _musicTarget();
// Safari/iOS loop fallback — iOS sometimes ignores audio.loop; the 'ended' listener catches it
_bgAudio.addEventListener('ended', function() {
  if (!_bgMuted) { _bgAudio.currentTime = 0; _bgAudio.play().catch(() => {}); }
});

// ── Round callout + game-over audio ───────────────────────────────────────
const _sfxWarnSting = new Audio('/audio/Warning-Sting.mp3'); _sfxWarnSting._base = 0.7; _sfxWarnSting.volume = 0.7 * _sfxLvl();
const _bgFinal = new Audio('/audio/final-round.mp3'); _bgFinal.loop = true; _bgFinal.volume = _musicTarget();
let _musicTrack = 'main'; // v0.5.05: which music track should be playing ('main' | 'final' | null)
_bgFinal.addEventListener('ended', function() {
  if (!_bgMuted && _bgFinal.loop === false) { _bgFinal.currentTime = 0; _bgFinal.play().catch(()=>{}); }
});

function _fadeOutAudio(audio, ms, onDone) {
  if (!audio.paused && audio.volume > 0) {
    const sv = audio.volume; const steps = 30; let s = 0;
    const iv = setInterval(() => {
      s++; audio.volume = Math.max(0, sv * (1 - s / steps));
      if (s >= steps) { audio.pause(); audio.currentTime = 0; clearInterval(iv); if (onDone) onDone(); }
    }, ms / steps);
  } else { audio.pause(); audio.currentTime = 0; if (onDone) onDone(); }
}

function _fadeInAudio(audio, target, ms) {
  audio.volume = 0;
  if (!_bgMuted) audio.play().catch(() => {});
  const steps = 30; let s = 0;
  const iv = setInterval(() => {
    s++; audio.volume = Math.min(target, target * s / steps);
    if (s >= steps) clearInterval(iv);
  }, ms / steps);
}

function _crossfadeToFinal() {
  _fadeOutAudio(_bgAudio, 1200, null);
  _musicTrack = 'final';
  setTimeout(() => { if (!_bgMuted) _fadeInAudio(_bgFinal, _musicTarget(), 1200); }, 600);
}

function _fadeInBgMain() {
  _musicTrack = 'main';
  if (_bgMuted) return;
  _bgFinal.pause(); _bgFinal.currentTime = 0;
  _bgAudio.currentTime = 0;
  _fadeInAudio(_bgAudio, _musicTarget(), 1200);
}

function _fireRoundCallout(type) {
  const ov = document.getElementById('round-callout-overlay');
  if (!ov) return;
  if (type === 'penultimate') {
    ov.className = 'visible penultimate';
    document.getElementById('rco-bg').style.display  = 'none';
    document.getElementById('rco-icon').style.display = '';
    document.getElementById('rco-icon').textContent  = '⚠️';
    document.getElementById('rco-title').textContent = 'PENULTIMATE ROUND';
    document.getElementById('rco-sub').textContent   = 'One more round after this!';
  } else {
    ov.className = 'visible final';
    document.getElementById('rco-bg').style.display  = 'flex';
    document.getElementById('rco-icon').style.display = 'none';
    document.getElementById('rco-title').textContent = 'FINAL ROUND';
    document.getElementById('rco-sub').textContent   = 'This is the last round!';
  }
  _playSfx(_sfxWarnSting);
  if (type === 'final') _crossfadeToFinal();
  // v0.6.25: animated art callouts (moments.js) — longer holds so the moment lands
  let holdMs = type === 'final' ? 2000 : 1500;
  if (window.SGMoments) {
    ov.className = '';                                   // old text overlay stays hidden
    holdMs = type === 'final' ? 4500 : 3500;
    if (type === 'final') SGMoments.final(holdMs, 'This is the last round');
    else SGMoments.penultimate(holdMs, 'One more round after this');
    setTimeout(() => send('round_callout_complete'), holdMs + 450);
    return;
  }
  setTimeout(() => {
    ov.classList.add('fade-out');
    setTimeout(() => { ov.className = ''; }, 400);
    send('round_callout_complete');
  }, holdMs);
}

function _fireGameOverFanfare() {
  _bgAudio.pause(); _bgFinal.pause(); _musicTrack = null;
  const fo = document.getElementById('go-fanfare-overlay');
  // v0.6.25: animated Game Over (moments.js) hands off into the winners screen
  if (window.SGMoments) {
    const cols = (G && G.players ? G.players.map(p => p.color).filter(Boolean) : []);
    SGMoments.gameOver(() => {
      window._goEnterUntil = Date.now() + 4000;
      document.querySelectorAll('.winners-overlay').forEach(w => w.classList.add('go-enter'));
    }, cols);
  } else if (fo) {
    fo.className = 'visible';
    const holdMs = 4500;
    setTimeout(() => {
      fo.classList.add('fade-out');
      setTimeout(() => { fo.className = ''; }, 1200);
    }, holdMs);
  }
  setTimeout(() => {
    _playSfx(_sfxWarnSting);
    setTimeout(() => {
      _fadeOutAudio(_sfxWarnSting, 1200, () => { _fadeInBgMain(); });
    }, 4500);
  }, 300);
}

function _startBgMusic() {
  if (_bgStarted || _bgMuted) return;
  _bgStarted = true;
  _bgAudio.play().catch(() => {
    // Autoplay blocked — retry on first user interaction
    _bgStarted = false;
  });
}

// v0.5.05: apply current AUD levels to everything that's playing / will play
function _applyAudio() {
  const wasMuted = _bgMuted;
  _bgMuted = _musicLvl() <= 0;
  const mt = _musicTarget();
  _bgAudio.volume = mt; _bgFinal.volume = mt;
  if (_bgMuted) { _bgAudio.pause(); _bgFinal.pause(); }
  else if (wasMuted) {
    const tr = _musicTrack === 'final' ? _bgFinal : (_musicTrack === 'main' ? _bgAudio : null);
    if (tr) { tr.play().catch(() => {}); _bgStarted = true; }
  }
  const sl = _sfxLvl();
  [_sfxTitle, _sfxHitSlash, _sfxHitMagic, _sfxHitClaw, _sfxWarnSting].forEach(a => { a.muted = false; a.volume = (a._base || .5) * sl; });
  const btn = document.getElementById('mute-btn');
  if (btn) {
    const off = _bgMuted && sl <= 0;
    const hasLabel = btn.style.padding && btn.style.padding !== '';
    if (hasLabel) btn.innerHTML = `${off ? '🔇' : '⚙'}&nbsp;Sound Settings`;
    else btn.textContent = off ? '🔇' : '⚙';
  }
}
// Kept for any old callers — now opens the settings panel
function toggleMute() { openAudioSettings(); }

function openAudioSettings() {
  let ov = document.getElementById('audio-settings-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'audio-settings-overlay';
    ov.onclick = e => { if (e.target === ov) closeAudioSettings(); };
    document.body.appendChild(ov);
  }
  const row = (key, label, icon) => {
    const v = Math.round((+AUD[key] || 0) * 100), muted = AUD[key + 'Mute'];
    return `<div class="aus-row">
      <div class="aus-lbl"><span>${icon} ${label}</span><span class="aus-val" id="aus-${key}-val">${muted ? 'Muted' : v + '%'}</span></div>
      <div class="aus-ctl">
        <button class="aus-mute ${muted ? 'on' : ''}" id="aus-${key}-mute" onclick="_ausMute('${key}')" title="Mute">${muted ? '🔇' : '🔊'}</button>
        <input type="range" min="0" max="100" step="5" value="${v}" class="aus-range" id="aus-${key}" oninput="_ausSet('${key}', this.value)" ${muted ? 'style="opacity:.4"' : ''}>
      </div></div>`;
  };
  ov.innerHTML = `<div class="aus-box">
    <div class="aus-title">Sound Settings</div>
    <div class="aus-sub">${isSpectator ? 'Only affects this screen.' : 'Only affects this screen — spectators set their own.'}</div>
    ${row('music', 'Music', '🎵')}
    ${row('sfx', 'Sound Effects', '💥')}
    ${row('voice', 'Voices', '🗣')}
    ${window.BoardFX ? `<div class="aus-row"><div class="aus-lbl"><span>✨ Board Effects</span><span class="aus-val">${BoardFX.level === 'reduced' ? 'Reduced' : 'Full'}</span></div>
      <div class="aus-ctl" style="gap:8px;">
        <button class="egm-btn cancel" style="flex:1;${BoardFX.level === 'full' ? 'border-color:var(--accent);color:var(--accent-pale);' : 'opacity:.6;'}" onclick="BoardFX.setLevel('full');openAudioSettings()">Full</button>
        <button class="egm-btn cancel" style="flex:1;${BoardFX.level === 'reduced' ? 'border-color:var(--accent);color:var(--accent-pale);' : 'opacity:.6;'}" onclick="BoardFX.setLevel('reduced');openAudioSettings()">Reduced</button>
      </div></div>` : ''}
    <div class="aus-btns"><button class="egm-btn cancel" onclick="_ausTest()">Test Sound</button><button class="egm-btn cancel" onclick="closeAudioSettings()">Done</button></div>
  </div>`;
  ov.classList.add('visible');
}
function closeAudioSettings() { const ov = document.getElementById('audio-settings-overlay'); if (ov) ov.classList.remove('visible'); }
function _ausSet(key, val) {
  AUD[key] = Math.max(0, Math.min(100, +val)) / 100;
  if (AUD[key] > 0) AUD[key + 'Mute'] = false;
  _saveAud(); _applyAudio(); _ausRefresh(key);
  if (key === 'voice' && _voiceLvl() <= 0) _voiceStop();
}
function _ausMute(key) {
  AUD[key + 'Mute'] = !AUD[key + 'Mute'];
  _saveAud(); _applyAudio(); _ausRefresh(key);
  if (key === 'voice' && _voiceLvl() <= 0) _voiceStop();
}
function _ausRefresh(key) {
  const m = AUD[key + 'Mute'];
  const v = document.getElementById(`aus-${key}-val`), b = document.getElementById(`aus-${key}-mute`), r = document.getElementById(`aus-${key}`);
  if (v) v.textContent = m ? 'Muted' : Math.round(AUD[key] * 100) + '%';
  if (b) { b.textContent = m ? '🔇' : '🔊'; b.classList.toggle('on', m); }
  if (r) r.style.opacity = m ? '.4' : '';
}
function _ausTest() { SFX.unlock(); _playSfx(_sfxHitMagic); }

// Start music on first user interaction (browser autoplay policy)
document.addEventListener('click', () => {
  _startBgMusic();
  // Prime _sfxWarnSting so future non-gesture plays (WebSocket handlers) work
  _sfxWarnSting.volume = 0;
  _sfxWarnSting.play().then(() => { _sfxWarnSting.pause(); _sfxWarnSting.currentTime = 0; _sfxWarnSting.volume = _sfxWarnSting._base * _sfxLvl(); }).catch(() => {});
}, { once: true });
// Also try immediately (works if page was navigated to with user gesture)
window.addEventListener('load', () => { setTimeout(_startBgMusic, 500); });

// ─── Boot ───────────────────────────────────────────────────────────────────────────────────
// In embed mode (desktop layout iframe), hide the floating conn-chip — it would float over the board
if (isEmbed) { const _ec = document.getElementById('conn-chip'); if (_ec) _ec.style.display = 'none'; }
connect();

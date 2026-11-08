// Summoner's Gambit server · 10-network.js · HTTP + WebSocket server, lobby news, admin, static files, persistence, startup
// Loaded in order by server.js (v1.0.139, L2 split). All parts share one global scope, like <script> tags.
'use strict';

// ─── PURE NODE.JS HTTP + WEBSOCKET SERVER ────────────────────────────────────
// No external deps — uses only built-in 'http', 'fs', 'path', 'crypto', 'os'

const fs     = require('fs');
const crypto = require('crypto');

// v1.0.125: DATA_DIR = Railway Volume mount path (falls back to the app folder locally)
const DATA_DIR   = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const STATE_FILE = path.join(DATA_DIR, 'game-state.json');

// ─── Lobby news (v1.0.125) ────────────────────────────────────────────────────
const NEWS_FILE    = path.join(DATA_DIR, 'news.json');
const NEWS_IMG_DIR = path.join(DATA_DIR, 'news-img');
const ADMIN_KEY    = process.env.ADMIN_KEY || 'Baseattack@12';   // v1.0.134: fallback key (user's choice) — an ADMIN_KEY env var on Railway overrides it
const NEWS_TAGS    = ['update', 'news', 'maintenance'];
let news = { posts: [] };
try { if (fs.existsSync(NEWS_FILE)) news = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')); } catch (e) { console.error('[news] load failed', e.message); }
if (!Array.isArray(news.posts)) news.posts = [];
function saveNews() { try { fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 1), 'utf8'); } catch (e) { console.error('[news] save failed', e.message); } }
function publicNews() {
  const posts = news.posts.filter(p => p.published).sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 10)
    .map(p => ({ id: p.id, title: p.title, tag: p.tag, body: p.body, image: p.image || null, link: p.link || null, date: p.date }));
  const b = news.posts.find(p => p.published && p.banner);
  return { posts, banner: b ? { id: b.id, tag: b.tag, text: b.bannerText || b.title } : null };
}
function pushNews() {
  const msg = JSON.stringify({ type: 'news', news: publicNews() });
  for (const socket of clients.keys()) wsSend(socket, msg);
}
function newsAuthed(req) {
  if (ADMIN_KEY) return req.headers['x-admin-key'] === ADMIN_KEY;
  const ip = (req.socket && req.socket.remoteAddress) || '';
  return /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip) && !req.headers['x-forwarded-for'];
}
function readJsonBody(req, limit, cb) {
  let size = 0, chunks = [];
  req.on('data', c => { size += c.length; if (size > limit) { req.destroy(); return; } chunks.push(c); });
  req.on('end', () => { try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { cb(e); } });
}
function handleNewsApi(req, res) {
  const out = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return out(405, { ok: false });
  if (!newsAuthed(req)) return out(401, { ok: false, error: ADMIN_KEY ? 'Wrong admin key' : 'Set ADMIN_KEY on the server to edit news remotely' });
  readJsonBody(req, 4 * 1024 * 1024, (err, body) => {
    if (err) return out(400, { ok: false, error: 'Bad request' });
    const clean = (v, n) => String(v == null ? '' : v).slice(0, n);
    if (body.action === 'list') return out(200, { ok: true, posts: news.posts });
    if (body.action === 'save') {
      const p = body.post || {};
      let post = p.id && news.posts.find(x => x.id === p.id);
      if (!post) { post = { id: crypto.randomBytes(5).toString('hex'), date: Date.now() }; news.posts.push(post); }
      post.title = clean(p.title, 120); post.body = clean(p.body, 4000);
      post.tag = NEWS_TAGS.includes(p.tag) ? p.tag : 'news';
      post.link = /^https?:\/\//.test(p.link || '') ? clean(p.link, 500) : '';
      post.image = typeof p.image === 'string' && /^\/news-img\/[a-f0-9]+\.(png|jpe?g|webp|gif)$/.test(p.image) ? p.image : '';
      post.bannerText = clean(p.bannerText, 160);
      post.published = !!p.published;
      if (p.banner) news.posts.forEach(x => { x.banner = false; });
      post.banner = !!p.banner;
      post.updated = Date.now();
      saveNews(); pushNews();
      console.log(`[news] saved "${post.title}" (${post.published ? 'published' : 'draft'})`);
      return out(200, { ok: true, post });
    }
    if (body.action === 'delete') {
      news.posts = news.posts.filter(x => x.id !== body.id); saveNews(); pushNews();
      return out(200, { ok: true });
    }
    if (body.action === 'image') {
      const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(body.data || '');
      if (!m) return out(400, { ok: false, error: 'PNG, JPG, WebP or GIF only' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 2.5 * 1024 * 1024) return out(400, { ok: false, error: 'Image too big (max 2.5 MB)' });
      try { fs.mkdirSync(NEWS_IMG_DIR, { recursive: true }); } catch {}
      const name = crypto.randomBytes(8).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
      fs.writeFileSync(path.join(NEWS_IMG_DIR, name), buf);
      return out(200, { ok: true, url: '/news-img/' + name });
    }
    out(400, { ok: false, error: 'Unknown action' });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.wav':  'audio/wav',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.mp3':  'audio/mpeg',
  '.ico':  'image/x-icon',
};

// ─── WebSocket helpers ────────────────────────────────────────────────────────
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsHandshake(socket, req) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return true;
}

function wsSend(socket, data) {
  if (socket.destroyed) return;
  // v1.0.90: accepts a pre-serialized JSON string (broadcast builds shared state once)
  const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch {}
}

// Parse a single frame from a Buffer; returns {opcode, text} or null if incomplete
// v1.0.130 (S6): game messages are a few hundred bytes; anything over 64 KB is refused and the connection closed
const WS_MAX_FRAME = 64 * 1024;
function wsParseFrame(buf) {
  if (buf.length < 2) return null;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); offset = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2)); offset = 10;
  }
  if (len > WS_MAX_FRAME) return { tooBig: true };   // v1.0.130 (S6)
  const total = offset + (masked ? 4 : 0) + len;
  if (buf.length < total) return null;
  const opcode = buf[0] & 0x0f;
  let payload;
  if (masked) {
    const mask = buf.slice(offset, offset + 4);
    payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) payload[i] = buf[offset + 4 + i] ^ mask[i % 4];
  } else {
    payload = buf.slice(offset, offset + len);
  }
  return { opcode, text: payload.toString(), consumed: total };
}

// ─── Admin API (v1.0.126, S2) ──────────────────────────────────────────────────
function adminRoomsList() {
  const now = Date.now();
  return [...rooms.entries()].map(([code, room]) => ({
    code, phase: room.phase, players: room.players.length,
    conns: [...clients.values()].filter(c => c.roomCode === code).length,
    idleSec: Math.round((now - (room.lastActivityAt || 0)) / 1000),
    names: room.players.map(p => p.name + (p.isConnected ? '' : ' (dc)')),
    hosted: !!room.hostKey,
  }));
}
function handleAdminApi(req, res) {
  const out = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST') return out(405, { ok: false, error: 'POST only' });
  if (!newsAuthed(req)) return out(401, { ok: false, error: ADMIN_KEY ? 'Wrong admin key' : 'Set ADMIN_KEY on the server to use admin remotely' });
  readJsonBody(req, 16 * 1024, (err, body) => {
    if (err) return out(400, { ok: false, error: 'Bad request' });
    const code = String(body.code || '').toUpperCase().trim();
    switch (body.action) {
      case 'rooms': return out(200, { ok: true, version: SERVER_VERSION, clients: clients.size, rooms: adminRoomsList() });
      case 'clear': {
        if (!rooms.has(code)) return out(404, { ok: false, error: 'Room not found' });
        rooms.delete(code); bumpRoomEpoch(code); saveState(); console.log(`[admin] cleared room ${code}`);
        return out(200, { ok: true, cleared: [code] });
      }
      case 'clear-stale': {
        const cleared = [];
        for (const [c] of rooms) if (![...clients.values()].some(x => x.roomCode === c)) { rooms.delete(c); bumpRoomEpoch(c); cleared.push(c); }
        saveState(); console.log(`[admin] cleared stale rooms: ${cleared.join(', ') || 'none'}`);
        return out(200, { ok: true, cleared });
      }
      case 'clear-all': {
        const cleared = [...rooms.keys()]; cleared.forEach(bumpRoomEpoch); rooms.clear(); saveState();
        console.log(`[admin] cleared ALL rooms (${cleared.length})`);
        return out(200, { ok: true, cleared });
      }
      case 'host-reset': {
        const room = rooms.get(code);
        if (!room) return out(404, { ok: false, error: 'Room not found' });
        delete room.hostKey; saveState(); console.log(`[admin] host reset for room ${code}`);
        return out(200, { ok: true, reset: code });
      }
      default: return out(400, { ok: false, error: 'Unknown action' });
    }
  });
}
const ADMIN_PAGE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SG Admin — ${SERVER_VERSION}</title>
<style>
  body{background:#0d0e1c;color:#c8c9e0;font-family:system-ui,sans-serif;padding:32px;margin:0}
  h1{font-size:20px;color:#9184d9;margin:0 0 4px}
  .sub{color:#666;font-size:13px;margin-bottom:24px}
  table{border-collapse:collapse;width:100%;max-width:960px}
  th{text-align:left;padding:8px 12px;border-bottom:2px solid #2a2b3d;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  td{padding:8px 12px;border-bottom:1px solid #1e1f2e}
  .actions{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
  button,.action{padding:8px 18px;border-radius:8px;border:1px solid;cursor:pointer;font-size:14px}
  .btn-stale{background:#2a2a1a;border-color:#8a7a30;color:#c9a050}
  .btn-all{background:#2a1a1a;border-color:#a04040;color:#e08080}
  .btn-ref{background:#1a1a2a;border-color:#4040a0;color:#8080e0}
  .small{padding:4px 10px;font-size:13px;border-radius:6px}
  .clr{background:#5c2a2a;border-color:#a04040;color:#e08080}
  .hr{background:#1a2a2a;border-color:#3a7a7a;color:#7fc9c9}
  input{background:#16172a;border:1px solid #2a2b3d;color:#c8c9e0;padding:8px 10px;border-radius:8px;font-size:14px}
  .msg{color:#e0a060;font-size:14px;min-height:20px;margin-bottom:12px}
  .empty{color:#555;padding:20px 0;font-size:14px}
</style></head><body>
<h1>Summoners Gambit — Admin</h1>
<div class="sub" id="sub">${SERVER_VERSION}</div>
<div class="actions">
  <input id="key" type="password" placeholder="Admin key" autocomplete="current-password">
  <button class="btn-ref" onclick="saveKey()">Unlock</button>
</div>
<div class="msg" id="msg"></div>
<div class="actions" id="acts" hidden>
  <button class="btn-stale" onclick="act('clear-stale')">⚡ Clear Stale (no connections)</button>
  <button class="btn-all" onclick="if(confirm('Clear ALL rooms? This disconnects everyone.'))act('clear-all')">☠ Clear ALL Rooms</button>
  <a class="action" href="/admin/news" style="text-decoration:none;background:#c9a05a;color:#1a1710;border-color:#c9a05a">📜 Lobby News</a>
  <button class="btn-ref" onclick="load()">↺ Refresh</button>
</div>
<div id="rooms"></div>
<script>
let KEY=''; try{KEY=localStorage.getItem('sg_admin_key')||'';}catch(e){}
document.getElementById('key').value=KEY;
function saveKey(){KEY=document.getElementById('key').value.trim();try{localStorage.setItem('sg_admin_key',KEY);}catch(e){}load();}
function api(body){return fetch('/admin/api',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':KEY},body:JSON.stringify(body)}).then(r=>r.json());}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function idle(s){return s<60?s+'s':s<3600?Math.round(s/60)+'m':Math.round(s/3600)+'h';}
function load(){
  api({action:'rooms'}).then(d=>{
    const msg=document.getElementById('msg');
    if(!d.ok){msg.textContent=d.error||'Not allowed';document.getElementById('acts').hidden=true;document.getElementById('rooms').innerHTML='';return;}
    msg.textContent='';document.getElementById('acts').hidden=false;
    document.getElementById('sub').textContent=d.version+' · '+d.rooms.length+' room(s) in memory · '+d.clients+' connection(s)';
    if(!d.rooms.length){document.getElementById('rooms').innerHTML='<div class="empty">No rooms in memory.</div>';return;}
    document.getElementById('rooms').innerHTML='<table><thead><tr><th>Code</th><th>Phase</th><th>Players</th><th>Conns</th><th>Idle</th><th>Names</th><th></th></tr></thead><tbody>'+
      d.rooms.map(r=>'<tr style="background:'+(r.conns?'#1a2a1a':'#2a1a1a')+'"><td style="font-family:monospace;font-size:16px;letter-spacing:.1em;color:#c9a050">'+esc(r.code)+'</td><td>'+esc(r.phase)+'</td><td>'+r.players+'</td><td style="color:'+(r.conns?'#5dc97d':'#e05252')+'">'+r.conns+'</td><td style="color:#888">'+idle(r.idleSec)+' ago</td><td style="max-width:220px;font-size:12px;color:#aaa">'+esc(r.names.join(', ')||'—')+'</td><td style="white-space:nowrap"><button class="small hr" onclick="act(\\'host-reset\\',\\''+esc(r.code)+'\\')" title="Let the next board that opens this room become the host">Reset host</button> <button class="small clr" onclick="if(confirm(\\'Clear room '+esc(r.code)+'?\\'))act(\\'clear\\',\\''+esc(r.code)+'\\')">Clear</button></td></tr>').join('')+'</tbody></table>';
  }).catch(()=>{document.getElementById('msg').textContent='Could not reach the server.';});
}
function act(action,code){api({action,code}).then(d=>{document.getElementById('msg').textContent=d.ok?(d.cleared?(d.cleared.length?'Cleared: '+d.cleared.join(', '):'Nothing to clear'):'Host reset for '+d.reset+' — the next board to open it becomes host'):(d.error||'Failed');load();});}
load();
</script></body></html>`;

// ─── HTTP static file server ──────────────────────────────────────────────────
const PUBLIC = path.join(__dirname, 'public');

function serveStatic(req, res) {
  // v1.0.126 (S1): a malformed URL (e.g. /%E0%A4%A) used to throw here and kill the process
  let urlPath;
  try { urlPath = decodeURIComponent(String(req.url || '/').split('?')[0]); }
  catch { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Bad request'); return; }

  // Health-check endpoint
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      version: SERVER_VERSION,
      rooms: rooms.size,   // v1.0.126 (S3): room codes no longer listed here
    }));
    return;
  }

  // ── Lobby news (v1.0.125) ───────────────────────────────────────────────────
  if (urlPath === '/news.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(publicNews())); return;
  }
  if (urlPath.startsWith('/news-img/')) {
    const name = urlPath.slice(10);
    if (!/^[a-f0-9]+\.(png|jpe?g|webp|gif)$/.test(name)) { res.writeHead(404); res.end(); return; }
    fs.readFile(path.join(NEWS_IMG_DIR, name), (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name)] || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }); res.end(data);
    });
    return;
  }
  if (urlPath === '/admin/news/api') { handleNewsApi(req, res); return; }
  if (urlPath === '/admin/news') {
    fs.readFile(path.join(__dirname, 'admin-news.html'), (err, data) => {
      if (err) { res.writeHead(500); res.end('admin-news.html missing'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(data);
    });
    return;
  }

  // ── Admin endpoints ─────────────────────────────────────────────────────────

  // v1.0.126 (S2): every admin action is a POST to /admin/api with the admin key
  // (x-admin-key header; with no ADMIN_KEY set, only from this machine). The old GET
  // /admin/clear… links are gone so a crawler or a stray click can't wipe games.
  if (urlPath === '/admin/api') { handleAdminApi(req, res); return; }
  if (urlPath.startsWith('/admin/clear')) {
    res.writeHead(410, { 'Content-Type': 'text/plain' }); res.end('Moved: use the /admin page'); return;
  }

  // Admin dashboard page
  if (urlPath === '/admin') {
    // v1.0.126 (S2): page shell only — room data loads through /admin/api once the key is accepted
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(ADMIN_PAGE_HTML);
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/board.html';
  if (urlPath === '/board')    urlPath = '/board.html';
  if (urlPath === '/player')   urlPath = '/player.html';
  if (urlPath === '/spectate') urlPath = '/board.html'; // spectator uses same board view
  if (urlPath === '/battle-tester') urlPath = '/battle-tester.html';

  const filePath = path.join(PUBLIC, urlPath);
  // Security: ensure we stay within public/
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    // v1.0.101: pages + scripts must always revalidate so a deploy reaches phones on the next load;
    // art/audio can be cached for a day.
    const cache = (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json') ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  });
}

// ─── Client registry ──────────────────────────────────────────────────────────
// Map: socket → { playerIdx: null|number, buf: Buffer }
const clients = new Map();

// Shim: make socket look like a ws object so existing code (wsSend, sendError, broadcast) works
function socketSend(socket, json) { wsSend(socket, json); }

// Redefine sendError to work with raw socket
function sendError(socket, msg) {
  wsSend(socket, { type:'error', message: msg });
}

// ─── State persistence ────────────────────────────────────────────────────────
// Serialize the rooms Map to disk on every broadcast so process restarts
// (Railway deploys, crashes, idle scale-down) don't silently kill active games.
// Note: Railway's ephemeral filesystem persists within a running container but
// is wiped on redeploy — this protects against crashes/restarts, not redeploys.

// v1.0.90: debounced — broadcasts mark state dirty; disk write happens at most
// once per SAVE_DEBOUNCE_MS instead of a synchronous full write on every broadcast.
const SAVE_DEBOUNCE_MS = 2000;
let _saveTimer = null;
function saveState() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; saveStateNow(); }, SAVE_DEBOUNCE_MS);
}

function saveStateNow() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  try {
    const data = JSON.stringify([...rooms.entries()]);
    fs.writeFileSync(STATE_FILE, data, 'utf8');
  } catch (e) {
    console.error('[persist] save failed:', e.message);
  }
}

// Flush pending save on shutdown (Ctrl+C locally, SIGTERM on Railway redeploy/restart)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { saveStateNow(); process.exit(0); });
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const entries = JSON.parse(data);
    for (const [code, state] of entries) {
      // Only restore games that aren't over yet
      if (state && state.phase !== 'game_over') {
        rooms.set(code, state);
        console.log(`[persist] restored room ${code} (phase: ${state.phase})`);
        // v1.0.112: restart mid Auto Setup — timers are gone, so re-plan the remaining placements
        if (state.phase === 'setup' && state.autoSetupRunning) {
          inRoom(code, () => autoSetup());   // v1.0.140 (L1)
        }
      }
    }
  } catch (e) {
    console.error('[persist] load failed (starting fresh):', e.message);
  }
}

// Redefine broadcast to work with raw sockets — only sends to clients in the current room
function broadcast(extra = {}) {
  if (!G) return;
  // v1.0.140 (L1): G must be the live room for its code. An old copy (a room that was reset or cleaned up
  // since) would send stale state to that room's screens, so refuse and log it instead.
  if (rooms.get(G.roomCode) !== G) { glog(G.roomCode, '⚠ broadcast from a stale room object skipped'); return; }
  const _bt0 = process.hrtime.bigint();   // v1.0.135
  G.lastActivityAt = Date.now();
  const roomCode = G.roomCode;
  // v1.0.90: serialize shared game state ONCE per broadcast; per-player messages
  // only add their own myIdx + hand on top.
  const head = JSON.stringify({ type:'state', ...extra }).slice(0, -1);
  const sharedJson = head + ',"game":' + JSON.stringify(publicState());
  const spectatorMsg = sharedJson + '}';
  for (const [socket, conn] of clients) {
    if (socket.destroyed) continue;
    if (conn.roomCode !== roomCode) continue;
    const p = (conn.playerIdx !== null && conn.playerIdx !== undefined) ? G.players[conn.playerIdx] : null;
    if (!p) { wsSend(socket, spectatorMsg); _bstat.bytes += spectatorMsg.length; continue; }
    const hand = p.hand.map(m => serializeHandMonster(m, conn.playerIdx));
    _bstat.bytes += sharedJson.length + 200;   // v1.0.135 (approx.)
    wsSend(socket, sharedJson + ',"myIdx":' + conn.playerIdx + ',"hand":' + JSON.stringify(hand) + ',"mySummary":' + JSON.stringify(p.lastSummary || null) + '}');   // v1.0.121
  }
  _bstat.n++; _bstat.ms += Number(process.hrtime.bigint() - _bt0) / 1e6;   // v1.0.135
  // Persist (debounced)
  saveState();
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // v1.0.126 (S1): any error while serving one request answers 500 instead of crashing the server
  try { serveStatic(req, res); }
  catch (err) {
    console.error('[http] request failed:', req.url, err);
    try { if (!res.headersSent) res.writeHead(500); res.end(); } catch {}
  }
});
// v1.0.126 (S1): last-resort guard — log, save, keep serving the other rooms
process.on('uncaughtException', err => { reportCrash('uncaught exception', err, G && G.roomCode); try { saveStateNow(); } catch {} });   // v1.0.134
process.on('unhandledRejection', err => { console.error('[fatal-guard] unhandled rejection:', err); });

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade'] !== 'websocket') { socket.destroy(); return; }
  if (!wsHandshake(socket, req)) return;

  const conn = { playerIdx: null, sessionKey: null, roomCode: null, isBoard: false, isSpectator: false, buf: Buffer.alloc(0) };
  clients.set(socket, conn);

  // ── Keep-alive: server pings every 20s to prevent proxy/NAT idle-timeout drops ──
  conn.lastPong = Date.now();
  const keepAlive = setInterval(() => {
    if (socket.destroyed) { clearInterval(keepAlive); return; }
    // Drop connections that haven't ponged in 55 seconds (2+ missed pings)
    if (Date.now() - conn.lastPong > 55000) {
      clearInterval(keepAlive);
      socket.destroy();
      return;
    }
    // Send WebSocket ping frame (opcode 0x89, no payload)
    const ping = Buffer.alloc(2); ping[0] = 0x89; ping[1] = 0;
    try { socket.write(ping); } catch { clearInterval(keepAlive); }
  }, 20000);
  socket.on('close', () => clearInterval(keepAlive));
  socket.on('error', () => clearInterval(keepAlive));

  // Send a ready ping — client sends board_connect or join to get room state
  wsSend(socket, { type: 'news', news: publicNews() });   // v1.0.125: lobby news before anything else
  wsSend(socket, { type: 'ready' });   // v1.0.126 (S3): no longer lists every room code

  socket.on('data', (chunk) => {
    conn.buf = Buffer.concat([conn.buf, chunk]);
    // Any data from the client means the TCP connection is alive — reset the dead-timer.
    // This is defense-in-depth alongside the explicit pong frame check below.
    conn.lastPong = Date.now();
    // v1.0.130 (S6): never buffer more than one maximum-size message
    if (conn.buf.length > WS_MAX_FRAME + 14) { conn.buf = Buffer.alloc(0); socket.destroy(); return; }
    while (true) {
      const frame = wsParseFrame(conn.buf);
      if (!frame) break;
      if (frame.tooBig) { console.warn('[ws] message over 64 KB — closing connection'); conn.buf = Buffer.alloc(0); socket.destroy(); return; }   // v1.0.130
      conn.buf = conn.buf.slice(frame.consumed);

      if (frame.opcode === 0x8) { socket.destroy(); break; }  // close
      if (frame.opcode === 0x9) {
        // client ping → respond with pong (0x8a full byte, but opcode bits only = 0x0a)
        const pong = Buffer.alloc(2); pong[0] = 0x8a; pong[1] = 0;
        try { socket.write(pong); } catch {}
        continue;
      }
      // FIX: wsParseFrame extracts opcode as buf[0] & 0x0f (lower 4 bits).
      // Pong full byte = 0x8A, but extracted opcode = 0x0A (10), NOT 0x8a (138).
      // The previous check (=== 0x8a) never matched, so conn.lastPong was never updated
      // from pong frames — causing every connection to be killed after 55s.
      if (frame.opcode === 0x0a) {
        // client pong → confirm connection is alive (lastPong already updated above)
        continue;
      }
      if (frame.opcode !== 0x1) continue; // only handle text frames

      let data;
      try { data = JSON.parse(frame.text); } catch { continue; }

      const action = data.action;
      if (!action || typeof action !== 'string') continue;
      const handler = Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : null;   // v1.0.133 (S7): no inherited names like "constructor"
      if (!handler) { sendError(socket, 'Unknown action: ' + action); continue; }

      // v1.0.134: crash trail — who did what (hands and keys left out)
      if (conn.roomCode && action !== 'client_error' && action !== 'sanction_preview' && action !== 'preview_attacker') {
        const _who = conn.isBoard ? 'BOARD' : conn.isSpectator ? 'spectator' : ((rooms.get(conn.roomCode) || {}).players || [])[conn.playerIdx]?.name || 'phone';
        const _d = Object.keys(data).filter(k => k !== 'action' && k !== 'hostKey' && k !== 'sessionKey').map(k => k + '=' + JSON.stringify(data[k]).slice(0, 30)).join(' ');
        trail(conn.roomCode, `> ${_who}: ${action}${_d ? ' ' + _d : ''}`);
      }
      // Spectators can only send spectate_connect — block everything else
      if (conn.isSpectator && action !== 'spectate_connect' && action !== 'client_error') {
        sendError(socket, 'Spectators cannot perform game actions'); continue;
      }

      // v1.0.140 (L1): run the handler inside this connection's room only (a join / board_connect may switch it)
      const _at0 = process.hrtime.bigint(); _bstat = { n: 0, bytes: 0, ms: 0 };
      let _gotCode = null;
      inRoom(conn.roomCode, () => {
        try {
          handler(socket, conn, data);
        } catch (err) {
          reportCrash(`action "${action}"`, err, conn.roomCode);   // v1.0.134
          sendError(socket, 'Server error: ' + err.message);
        }
        _gotCode = G && G.roomCode;
      });
      // v1.0.135: live log line for the action (client_perf / client_error log themselves)
      if (action !== 'client_perf' && action !== 'client_error') {
        const _code = conn.roomCode || _gotCode;
        const _room = _code && rooms.get(_code);
        const _who = conn.isBoard ? 'BOARD' : conn.isSpectator ? 'spectator' : (_room && _room.players[conn.playerIdx] ? _room.players[conn.playerIdx].name : 'phone');
        const _d = Object.keys(data).filter(k => !['action', 'hostKey', 'sessionKey', 'stack'].includes(k)).map(k => k + '=' + JSON.stringify(data[k]).slice(0, 24)).join(' ');
        const _ms = Number(process.hrtime.bigint() - _at0) / 1e6;
        glog(_code, `> ${_who}: ${action}${_d ? ' ' + _d : ''} · ${_ms.toFixed(1)}ms${_bsum()}${_room ? ' → ' + _room.phase : ''}`);
      }
    }
  });

  function handleDisconnect() {
    const conn = clients.get(socket);
    clients.delete(socket);
    if (!conn || !conn.roomCode) return;
    { const r = rooms.get(conn.roomCode); const who = conn.isBoard ? 'BOARD' : conn.isSpectator ? 'spectator' : (r && r.players[conn.playerIdx] ? r.players[conn.playerIdx].name : 'phone');
      glog(conn.roomCode, `✖ ${who} disconnected`); }   // v1.0.135
    inRoom(conn.roomCode, () => _onDisconnect(conn));   // v1.0.140 (L1)
  }
  function _onDisconnect(conn) {
    if (!G) return;

    if (G.phase === 'lobby' && conn.playerIdx !== null && conn.playerIdx !== undefined) {
      // In lobby: mark disconnected (same as in-game) so rejoin with sessionKey works.
      // Previously we deleted the slot immediately — but that meant rejoin failed and
      // the player had to re-enter their info, causing a visible disconnect/rejoin flash.
      const p = G.players.find(pl => pl.idx === conn.playerIdx);
      if (p && p.isConnected) {
        p.isConnected = false;
        log(`⚠ ${p.name} disconnected from lobby`);
        broadcast();
      }
    } else if (G.phase !== 'lobby' && conn.playerIdx !== null && conn.playerIdx !== undefined) {
      // In game: mark disconnected and pause
      const p = G.players[conn.playerIdx];
      if (p && p.isConnected) {
        p.isConnected = false;
        // Eliminated players are already out — don't pause the game for them
        if (p.eliminated) {
          log(`👻 ${p.name} (eliminated) disconnected — no pause`);
          broadcast();
          return;
        }
        if (!G.pausedFor) {
          G.pausedFor = { idx: p.idx, name: p.name, color: p.color };
          log(`⚡ ${p.name} disconnected — game paused`);
        }
        broadcast();
      }
    }
  }
  socket.on('close', handleDisconnect);
  socket.on('error', handleDisconnect);
});

// v1.0.135: another server is already on this port — say so and quit (the crash guard used to keep this copy alive)
server.on('error', err => {
  if (err && err.code === 'EADDRINUSE') { console.error(`\n  Port ${PORT} is already in use — another copy of the server is running. Close it first.\n`); process.exit(1); }
  reportCrash('http server', err);
});
server.listen(PORT, '0.0.0.0', () => {
  loadState();
  const ip = getLocalIp();
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log(`  ║   Summon Board Game — Server ${SERVER_VERSION}  ║`);
  console.log('  ╠════════════════════════════════════════╣');
  console.log(`  ║  Board view  →  http://${ip}:${PORT}/board  `);
  console.log(`  ║  Player view →  http://${ip}:${PORT}/player `);
  console.log('  ║  (share these URLs with players on     ║');
  console.log('  ║   the same WiFi network)               ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');

  // ── Stale room cleanup — runs every 2 minutes ──────────────────────────────
  // Prevents rooms from accumulating indefinitely in memory and on disk.
  // A room is removed only when it has NO active connections AND exceeds the idle threshold:
  //   game_over        →  5 min  (results seen, nothing to keep)
  //   setup            → 10 min  (pre-game phase, clearly abandoned)
  //   lobby (0 players)→ 10 min  (empty shell, board closed without playing)
  //   lobby (has players)→30 min (players may still be joining)
  //   any mid-game phase→ 60 min (disconnected players get time to rejoin via session key)
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [code, room] of rooms) {
      const idle = now - (room.lastActivityAt || 0);
      const hasConn = [...clients.values()].some(c => c.roomCode === code);
      if (hasConn) continue; // active connections — never evict
      const phase = room.phase;
      if (phase === 'game_over'                                         && idle >  5 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (phase === 'setup'                                             && idle > 10 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (phase === 'lobby' && room.players.length === 0                && idle > 10 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (phase === 'lobby' && room.players.length > 0                 && idle > 30 * 60 * 1000) { rooms.delete(code); cleaned++; continue; }
      if (idle > 60 * 60 * 1000) { rooms.delete(code); cleaned++; continue; } // mid-game: 1 hour
    }
    if (cleaned > 0) {
      console.log(`[cleanup] removed ${cleaned} stale room(s) — ${rooms.size} remaining`);
      saveState();
    }
  }, 2 * 60 * 1000);
});


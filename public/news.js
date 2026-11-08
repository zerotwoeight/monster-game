// Summoner's Gambit — Lobby news (v1.1 · board v0.6.66 / player v0.5.54: fixed-size board ticker, phone pill wraps · server v1.0.125 / board v0.6.44 / player v0.5.41)
// Shared by board.html and player.html. The server pushes {type:'news'} on connect and whenever /admin/news publishes.
// Pages: call SGNews.set(msg.news) on the message, SGNews.setContext('lobby'|'game') when the screen changes,
// and SGNews.refresh() after rendering a screen that holds a slot (#sg-news-ticker on the board, #sg-news-pill on phones).
(function () {
  const TAGS = {
    update:      { label: 'Update',      bg: '#a97b40' },
    news:        { label: 'News',        bg: '#4b5fa8' },
    maintenance: { label: 'Maintenance', bg: '#b4473a' },
  };
  const BANNER_BG = { update: '#c9a05a', news: '#b5abfc', maintenance: '#e08a7c' };
  const LS_SEEN = 'sg_news_seen', LS_BANNER = 'sg_news_banner_closed';
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  let data = { posts: [], banner: null };
  let context = 'lobby', tickerRef = null;
  const isPhone = /\/player/.test(location.pathname);

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // tiny markdown: **bold**, *italic*, [text](https://…), "- " lists, blank line = new paragraph
  function md(src) {
    const inline = t => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return String(src || '').split(/\n{2,}/).map(block => {
      const lines = block.split('\n');
      if (lines.every(l => /^\s*[-•]\s+/.test(l))) return '<ul>' + lines.map(l => '<li>' + inline(l.replace(/^\s*[-•]\s+/, '')) + '</li>').join('') + '</ul>';
      return '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  }
  const plain = s => String(s || '').replace(/\n\s*[-•]\s+/g, ' · ').replace(/\*\*|\*|\[([^\]]+)\]\([^)]+\)/g, (m, t) => t || '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim();
  const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const tagOf = p => TAGS[p.tag] || TAGS.news;
  const unread = () => { const seen = ls.get(LS_SEEN) || []; return data.posts.filter(p => !seen.includes(p.id)).length; };
  const markAllSeen = () => ls.set(LS_SEEN, data.posts.map(p => p.id));

  // ── styles ───────────────────────────────────────────────────────────────
  const css = `
  .sgn-banner{position:fixed;left:0;right:0;top:0;z-index:9000;display:flex;align-items:center;gap:14px;padding:10px 18px 10px 24px;color:#1a1710;font-family:Inter,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4);animation:sgnDrop .45s cubic-bezier(.2,.9,.3,1.2)}
  .sgn-banner .sgn-btag{font-family:'Cinzel',serif;font-weight:900;font-size:12px;letter-spacing:.18em;padding:3px 9px;border:1.5px solid #1a1710;border-radius:4px;text-transform:uppercase;white-space:nowrap}
  .sgn-banner .sgn-btext{flex:1;font-size:16px;font-weight:600;line-height:1.3}
  .sgn-x{width:44px;height:44px;flex-shrink:0;border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer;border-radius:8px}
  .sgn-x:hover{background:rgba(0,0,0,.08)}
  @keyframes sgnDrop{from{transform:translateY(-100%)}to{transform:none}}
  .sgn-ticker{width:100%;max-width:960px;min-width:0;height:104px;overflow:hidden;box-sizing:border-box;display:flex;align-items:center;gap:18px;padding:14px 18px;margin-top:6px;background:#e8d5b0;color:#1a1710;border:2px solid #a97b40;border-radius:10px;cursor:pointer;text-align:left;font:inherit;position:relative;z-index:2;transition:transform .15s,box-shadow .15s}
  .sgn-ticker:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.45)}
  .sgn-seal{width:54px;height:54px;flex-shrink:0;border-radius:50%;background:#a97b40;color:#f5efe0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-weight:900;font-size:11px;letter-spacing:.1em;box-shadow:inset 0 0 0 3px rgba(0,0,0,.15)}
  .sgn-tk-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
  .sgn-meta{font-family:'Cinzel',serif;font-weight:700;font-size:11px;letter-spacing:.16em;color:#7a6040;text-transform:uppercase}
  .sgn-tk-title{font-family:'Cinzel',serif;font-weight:700;font-size:24px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sgn-tk-body{font-size:14px;color:#6b5a3a;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;line-height:1.35}
  .sgn-tk-all{flex-shrink:0;font-family:'Cinzel',serif;font-weight:700;font-size:13px;letter-spacing:.1em;padding:11px 14px;border:1.5px solid #7a6040;border-radius:8px;color:#7a6040}
  .sgn-overlay{position:fixed;inset:0;z-index:9500;background:rgba(4,4,10,.78);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;animation:sgnFade .2s}
  @keyframes sgnFade{from{opacity:0}}
  .sgn-modal{width:min(880px,100%);max-height:min(820px,100%);display:flex;flex-direction:column;background:#f5efe0;color:#1a1710;border:3px solid #a97b40;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:Inter,sans-serif;overflow:hidden}
  .sgn-mhead{display:flex;align-items:center;gap:12px;padding:22px 22px 14px 36px;border-bottom:1.5px solid #a97b40}
  .sgn-mhead h2{flex:1;margin:0;font-family:'Cinzel',serif;font-weight:900;font-size:30px;letter-spacing:.06em}
  .sgn-list{overflow:auto;padding:8px 36px 28px}
  .sgn-post{padding:20px 0;border-bottom:1px solid #e8d5b0}
  .sgn-post:last-child{border-bottom:0}
  .sgn-prow{display:flex;gap:10px;align-items:center;margin-bottom:6px}
  .sgn-chip{font-family:'Cinzel',serif;font-weight:700;font-size:11px;letter-spacing:.14em;color:#f5efe0;padding:3px 9px;border-radius:4px;text-transform:uppercase}
  .sgn-date{font-size:13px;color:#6b5a3a}
  .sgn-dot{width:8px;height:8px;border-radius:4px;background:#b4473a}
  .sgn-ptitle{font-family:'Cinzel',serif;font-weight:700;font-size:24px;line-height:1.2;margin:0 0 6px}
  .sgn-pimg{display:block;width:100%;max-height:320px;object-fit:cover;border-radius:8px;margin:8px 0 10px}
  .sgn-pbody{font-size:16px;line-height:1.55;color:#3a3020}
  .sgn-pbody p{margin:0 0 8px}.sgn-pbody ul{margin:0 0 8px;padding-left:22px}
  .sgn-pbody a,.sgn-more{color:#7a6040;font-weight:600}
  .sgn-empty{padding:40px 0;text-align:center;color:#6b5a3a}
  .sgn-pill{position:relative;display:flex;align-items:center;gap:10px;max-width:100%;box-sizing:border-box;min-height:44px;margin:4px auto 14px;padding:8px 18px;text-align:left;border:0;border-radius:22px;background:#e8d5b0;color:#1a1710;font-family:'Cinzel',serif;font-weight:700;font-size:13px;letter-spacing:.1em;cursor:pointer}
  .sgn-pill span.t{font-family:Inter,sans-serif;font-weight:600;font-size:12px;letter-spacing:0;color:#6b5a3a;white-space:normal;overflow-wrap:anywhere;min-width:0;line-height:1.3}
  .sgn-badge{position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;background:#b4473a;color:#fff;font-family:Inter,sans-serif;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
  body.sgn-board .sgn-banner{top:auto;bottom:0;box-shadow:0 -4px 18px rgba(0,0,0,.4);animation-name:sgnRise}
  @keyframes sgnRise{from{transform:translateY(100%)}to{transform:none}}
  @media (max-width:600px){
    .sgn-overlay{padding:0}
    .sgn-modal{width:100%;height:100%;max-height:none;border:0;border-radius:0}
    .sgn-mhead{padding:12px 10px 10px 20px}.sgn-mhead h2{font-size:21px}
    .sgn-list{padding:4px 20px 24px}.sgn-ptitle{font-size:19px}.sgn-pbody{font-size:15px}
    .sgn-banner{position:relative;padding:6px 6px 6px 14px;gap:8px}.sgn-banner .sgn-btag{display:none}.sgn-banner .sgn-btext{font-size:13px}
  }
  @media (prefers-reduced-motion:reduce){.sgn-banner,.sgn-overlay{animation:none}.sgn-ticker{transition:none}}`;
  function injectCss() {
    if (document.getElementById('sgn-css')) return;
    const st = document.createElement('style'); st.id = 'sgn-css'; st.textContent = css; document.head.appendChild(st);
  }

  // ── banner (lobby / join screens only) ────────────────────────────────────
  function renderBanner() {
    injectCss();
    let el = document.getElementById('sgn-banner');
    const b = data.banner;
    const show = b && context === 'lobby' && ls.get(LS_BANNER) !== b.id + '|' + b.text;
    if (!show) { if (el) el.remove(); return; }
    if (!isPhone && /\/(board|spectate)/.test(location.pathname)) document.body.classList.add('sgn-board');
    if (!el) { el = document.createElement('div'); el.id = 'sgn-banner'; el.className = 'sgn-banner'; el.setAttribute('role', 'status'); isPhone ? document.body.prepend(el) : document.body.appendChild(el); }
    el.style.background = BANNER_BG[b.tag] || BANNER_BG.update;
    el.innerHTML = `<span class="sgn-btag">${esc(tagOf(b).label)}</span><span class="sgn-btext">${esc(b.text)}</span><button class="sgn-x" aria-label="Dismiss notice">×</button>`;
    el.querySelector('.sgn-x').onclick = () => { ls.set(LS_BANNER, b.id + '|' + b.text); el.remove(); };
  }

  // ── board ticker ───────────────────────────────────────────────────────────
  function renderTicker() {
    const slot = document.getElementById('sg-news-ticker') || tickerRef;   // tickerRef: slot built before it was attached
    if (!slot) return;
    injectCss();
    const p = data.posts[0];
    if (!p) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<button class="sgn-ticker" aria-label="Open news">
      <span class="sgn-seal">NEWS</span>
      <span class="sgn-tk-mid">
        <span class="sgn-meta">${esc(tagOf(p).label)} · ${esc(fmtDate(p.date))}</span>
        <span class="sgn-tk-title">${esc(p.title)}</span>
        <span class="sgn-tk-body">${esc(plain(p.body))}</span>
      </span>
      <span class="sgn-tk-all">ALL NEWS (${data.posts.length})</span>
    </button>`;
    slot.querySelector('button').onclick = openModal;
  }

  // ── phone pill ─────────────────────────────────────────────────────────────
  function renderPill() {
    const slot = document.getElementById('sg-news-pill');
    if (!slot) return;
    injectCss();
    const p = data.posts[0];
    if (!p) { slot.innerHTML = ''; return; }
    const n = unread();
    slot.innerHTML = `<button class="sgn-pill" aria-label="News${n ? ', ' + n + ' unread' : ''}">NEWS<span class="t">${esc(p.title)}</span>${n ? `<span class="sgn-badge">${n}</span>` : ''}</button>`;
    slot.querySelector('button').onclick = openModal;
  }

  // ── full list (board modal / phone sheet) ─────────────────────────────────
  function openModal() {
    injectCss();
    closeModal();
    const seen = ls.get(LS_SEEN) || [];
    const ov = document.createElement('div');
    ov.className = 'sgn-overlay'; ov.id = 'sgn-overlay';
    ov.innerHTML = `<div class="sgn-modal" role="dialog" aria-modal="true" aria-label="Herald's Notices">
      <div class="sgn-mhead"><h2>Herald's Notices</h2><button class="sgn-x" aria-label="Close">×</button></div>
      <div class="sgn-list">${data.posts.length ? data.posts.map(p => `
        <article class="sgn-post">
          <div class="sgn-prow"><span class="sgn-chip" style="background:${tagOf(p).bg}">${esc(tagOf(p).label)}</span><span class="sgn-date">${esc(fmtDate(p.date))}</span>${isPhone && !seen.includes(p.id) ? '<span class="sgn-dot" aria-label="Unread"></span>' : ''}</div>
          <h3 class="sgn-ptitle">${esc(p.title)}</h3>
          ${p.image ? `<img class="sgn-pimg" src="${esc(p.image)}" alt="">` : ''}
          <div class="sgn-pbody">${md(p.body)}</div>
          ${p.link ? `<a class="sgn-more" href="${esc(p.link)}" target="_blank" rel="noopener">Read more →</a>` : ''}
        </article>`).join('') : '<div class="sgn-empty">No news yet.</div>'}
      </div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
    ov.querySelector('.sgn-x').onclick = closeModal;
    document.body.appendChild(ov);
    markAllSeen(); renderPill();
  }
  function closeModal() { const o = document.getElementById('sgn-overlay'); if (o) o.remove(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('sgn-overlay')) { e.stopPropagation(); closeModal(); } }, true);

  function refresh() { renderBanner(); renderTicker(); renderPill(); }

  window.SGNews = {
    set(n) { data = { posts: (n && n.posts) || [], banner: (n && n.banner) || null }; refresh(); },
    setContext(c) { if (c === context) return; context = c; if (c !== 'lobby') closeModal(); renderBanner(); },
    refresh, open: openModal,
    mountTicker(el) { tickerRef = el; renderTicker(); }, close: closeModal,
    get data() { return data; },
  };
})();

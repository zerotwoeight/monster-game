import json, html, os, sys
from PIL import Image

SHOTS = sys.argv[1]; OUTDIR = sys.argv[2]; OUTHTML = sys.argv[3]
os.makedirs(OUTDIR, exist_ok=True)
frag = json.load(open('/tmp/claude-0/frag.json'))
VERS = 'server v1.0.98 · board v0.5.08 · player v0.5.19'
DATE = '2026-10-19'

sizes = {}
def img(name, maxw=None):
    """convert shots/<name>.png -> img/docs/<name>.webp, return (src, w, h)"""
    src = os.path.join(SHOTS, name + '.png')
    if not os.path.exists(src):
        raise SystemExit('missing shot ' + name)
    im = Image.open(src).convert('RGB')
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    out = os.path.join(OUTDIR, name + '.webp')
    im.save(out, 'WEBP', quality=84, method=6)
    sizes[name] = os.path.getsize(out)
    return f'img/docs/{name}.webp', im.width, im.height

def board(name, caption, note=''):
    s, w, h = img(name, 1440)
    return f'''<figure class="shot board"><a href="{s}" target="_blank"><img src="{s}" width="{w}" height="{h}" loading="lazy" alt="{html.escape(caption)}"></a>
<figcaption><b>{caption}</b>{(' — ' + note) if note else ''}</figcaption></figure>'''

def phone(name, caption, note=''):
    s, w, h = img(name, 780)
    return f'''<figure class="shot phone"><a href="{s}" target="_blank"><img src="{s}" width="{w}" height="{h}" loading="lazy" alt="{html.escape(caption)}"></a>
<figcaption><b>{caption}</b>{('<span>' + note + '</span>') if note else ''}</figcaption></figure>'''

def cards(name, caption, note=''):
    s, w, h = img(name)
    return f'''<figure class="shot cards"><a href="{s}" target="_blank"><img src="{s}" width="{w//2}" height="{h//2}" loading="lazy" alt="{html.escape(caption)}"></a>
<figcaption><b>{caption}</b>{(' — ' + note) if note else ''}</figcaption></figure>'''

def section(id, title, intro, body):
    return f'''<section class="section" id="{id}"><h2 class="section-title">{title}</h2>
{('<p class="intro">' + intro + '</p>') if intro else ''}{body}</section>'''

def grid(*items): return '<div class="phone-grid">' + ''.join(items) + '</div>'

NAV = []
def nav(group, items):
    NAV.append((group, items))

# ───────────────────────── content ─────────────────────────
S = []

S.append(section('overview', 'At a glance',
  'Every image on this page is a real screenshot of the game, captured from the current build with the real art, '
  'fonts and code. The board view is shot at its native 1440×900 canvas; phone screens at 390×844 (2× pixel density). '
  'Click any image to open it full size.',
  '<div class="hero">' + board('board-turn', 'Board view', 'the shared screen everyone watches') +
  '<div class="hero-phones">' + phone('phone-shop', 'Phone — shop') + phone('phone-waiting-ring', 'Phone — waiting') + '</div></div>'))
nav('Start', [('overview', 'At a glance'), ('tokens', 'Colour & type')])

# Tokens
tok_bg = [('--bg', '#0d0e1c', 'Page background'), ('--bg-deep', '#09091a', 'Deepest background'),
          ('--surface', '#151627', 'Panels'), ('--surface2', '#1c1e2b', 'Raised panels'),
          ('--border', '#272a38', 'Hairlines'), ('--border2', '#3f424d', 'Strong borders')]
tok_tx = [('--text', '#e9e9ed', 'Primary text'), ('--text-lo', '#b2b6ca', 'Secondary'), ('--text-dim', '#9397ab', 'Tertiary'), ('--text-mute', '#75798c', 'Muted / labels')]
tok_ac = [('--accent', '#9184d9', 'Accent / primary buttons'), ('--accent-lit', '#b5abfc', 'Accent light'), ('--accent-pale', '#d2cefd', 'Accent pale'),
          ('--gold', '#a97b40', 'Gold'), ('--gold-glow', '#c9a05a', 'Gold glow / highlights'),
          ('--good', '#4f9153', 'Positive (player view)'), ('--warn', '#c9843a', 'Warning'), ('--danger', '#b05050', 'Danger / low HP')]
tok_parch = [('--parch-hi', '#f5efe0', 'Right-rail parchment (top)'), ('--parch-lo', '#e8d5b0', 'Parchment (bottom)'), ('--parch-ink', '#1a1710', 'Parchment ink'), ('--parch-sub', '#6b5a3a', 'Parchment secondary')]
els = [('Light', '#e0c07a'), ('Dark', '#6b6b7a'), ('Arcane', '#7f92e8'), ('Undead', '#5fb3a4'), ('Beast', '#d98a5a'), ('Nature', '#3aaa5c'), ('Support', '#9aabbc')]
pcol = ['#e05252', '#5ca8e0', '#5dc97d', '#e0b050', '#c07fd8', '#60cdc0']

def sw(rows):
    return '<div class="swatch-row">' + ''.join(
        f'<div class="swatch"><div class="swatch-dot" style="background:{hx}"></div><div><div class="swatch-name">{n}</div><div class="swatch-hex">{hx} · {d}</div></div></div>'
        for n, hx, d in rows) + '</div>'
tokens = (
  '<h3 class="sub">Surfaces</h3>' + sw(tok_bg) +
  '<h3 class="sub">Text</h3>' + sw(tok_tx) +
  '<h3 class="sub">Accent, gold &amp; status</h3>' + sw(tok_ac) +
  '<h3 class="sub">Board right-rail parchment</h3>' + sw(tok_parch) +
  '<h3 class="sub">Elements</h3><p class="note">From <code>TYPE_COLOR</code> in <code>common.js</code> (also <code>--el-*</code> CSS vars). Dark is a cool grey and Nature a saturated green — older docs listed purple / pale green, which the game no longer uses.</p>' +
  '<div class="swatch-row">' + ''.join(f'<div class="swatch"><div class="swatch-dot" style="background:{c}"></div><div><div class="swatch-name">{e}</div><div class="swatch-hex">{c}</div></div></div>' for e, c in els) + '</div>' +
  '<h3 class="sub">Type wheel</h3><p class="note">Each element deals 2× to the one it beats and 0.5× to the one that beats it.</p>' +
  '<table class="elem-table" style="max-width:520px"><thead><tr><th>Element</th><th>Beats</th><th>Loses to</th></tr></thead><tbody>' +
  ''.join(f'<tr><td><span class="dot" style="background:{dict(els)[a]}"></span>{a}</td><td>{b}</td><td>{c}</td></tr>' for a, b, c in
          [('Light', 'Undead', 'Nature'), ('Dark', 'Beast', 'Arcane'), ('Arcane', 'Dark', 'Undead'), ('Undead', 'Arcane', 'Light'), ('Beast', 'Nature', 'Dark'), ('Nature', 'Light', 'Beast')]) +
  '</tbody></table>' +
  '<h3 class="sub">Players</h3><p class="note">Slot colours from <code>PLAYER_COLORS</code>; board tokens are <code>img/players/Player1–6.svg</code>.</p><div class="players">' +
  ''.join(f'<div class="pl"><img src="img/players/Player{i+1}.svg" width="44" height="44" alt=""><div class="pl-c" style="background:{c}"></div><div class="swatch-hex">P{i+1} · {c}</div></div>' for i, c in enumerate(pcol)) + '</div>' +
  '<h3 class="sub">Typography</h3><div class="type-row"><div><div class="t-cinzel">Summoners Gambit</div><div class="swatch-hex">Cinzel 400/600/700 — headings, card names, buttons, labels (often small caps-style with wide letter-spacing)</div></div>'
  '<div><div class="t-inter">Roll the dice to move and claim tiles.</div><div class="swatch-hex">Inter 400/500/600 — body text, stats, descriptions</div></div></div>'
)
S.append(section('tokens', 'Colour &amp; type', 'Values taken from the <code>:root</code> blocks of <code>board.html</code> and <code>player.html</code>.', tokens))

# Board view
bv = [
 ('bv-lobby', 'Lobby', 'Host opens <code>/board</code>. Room code, player and spectator URLs, QR code, joined players with starter sets, round-limit picker and Start Game. ⚙ opens sound settings.',
   board('board-lobby', 'Lobby with three players joined')),
 ('bv-setup', 'Setup phase', 'Players take turns placing their starting summons for free. The top bar shows setup round and turn; the right rail lists players and the event log.',
   board('board-setup', 'Setup — round 2 of 3')),
 ('bv-turn', 'A normal turn', '28-tile wheel with tile art, stationed summon cards, tile numbers and player banners. Centre shows the die; the parchment right rail shows each player\'s tiles, stationed count, battle record and Mana, then the live event log.',
   board('board-turn', 'Shop phase — Aria\'s turn') + board('board-landing', 'After a roll', 'the die shows the roll while the player picks one of three landing tiles')),
 ('bv-battle', 'Battles', 'The attacker card updates live as the player browses their hand; then the clash plays with hit animations, HP bars and ability callouts.',
   board('board-battle-preview', 'Battle engaged — live attacker preview') + board('board-battle-anim1', 'Clash animation') + board('board-battle-anim2', 'Clash animation — later beat')),
 ('bv-tally', 'Round income tally', 'From round 2, each turn starts with the board animating every stationed summon\'s income (with ability labels), then a compact summary callout.',
   board('board-tally', 'Income tally') + board('board-turn-summary', 'Turn summary callout')),
 ('bv-wild', 'Wild card event', 'Banner at the top of the wheel while the player chooses a wild card.',
   board('board-wildcard', 'Wild card banner')),
 ('bv-callouts', 'Round callouts', 'Played before the penultimate and final rounds (with Warning-Sting.mp3; the final round also crossfades to final-round music).',
   board('board-callout-penultimate', 'Penultimate round') + board('board-callout-final', 'Final round')),
 ('bv-pause', 'Dropouts — pause & Remove', 'A disconnect pauses the game. The host can Dismiss, Remove the player (two taps within 4 s), or End Game.',
   board('board-paused', 'Paused — player disconnected') + board('board-paused-armed', 'Remove armed (second tap confirms)')),
 ('bv-sound', 'Sound settings', 'Per-device Music and Sound Effects sliders with mute toggles, saved in the browser.',
   board('board-sound-settings', 'Sound settings (⚙)')),
 ('bv-gameover', 'Game over', 'Fanfare overlay, then the final standings with awards.',
   board('board-gameover-fanfare', 'Game over fanfare') + board('board-gameover', 'Final standings')),
]
nav('Board view', [(i, t) for i, t, _, _ in bv])
for i, t, intro, body in bv:
    S.append(section(i, 'Board — ' + t, intro, body))

# Phone
pv = [
 ('pv-join', 'Join & lobby', 'Room code, name, starter set (A–F) and an optional Desktop Mode. After joining, the lobby lists everyone.',
   grid(phone('phone-join', 'Join'), phone('phone-lobby', 'Lobby'))),
 ('pv-setup', 'Setup', 'How-to-play walkthrough first, then the board ring: pick an open tile on the ring and a summon from the hand strip; the sheet shows home-field boost or weak ground.',
   grid(phone('phone-setup-instructions', 'How to play'), phone('phone-setup-ring', 'Your setup turn', 'ring + hand strip'),
        phone('phone-setup-claim-sheet', 'Claim sheet'), phone('phone-setup-waiting', 'Waiting during setup'))),
 ('pv-waiting', 'Waiting & turn start', 'Between turns the phone shows the whole board as a ring that follows the active player, plus recent events. Your turn starts with the income summary.',
   grid(phone('phone-waiting-ring', 'Waiting — board ring'), phone('phone-turn-summary', 'Turn summary', 'income breakdown, upkeep, net Mana'))),
 ('pv-shop', 'Shop', 'One action per turn: buy, sell or skip. Tapping a card opens the swipeable detail sheet with the action button.',
   grid(phone('phone-shop', 'Shop'), phone('phone-shop-sheet', 'Shop detail sheet'))),
 ('pv-move', 'Roll & landing choice', 'Roll 2d6 (min 3), then choose one of three tiles. Each option opens a preview sheet before you commit.',
   grid(phone('phone-roll', 'Roll'), phone('phone-landing', 'Choose destination'), phone('phone-landing-sheet', 'Destination preview'))),
 ('pv-claim', 'Claim', 'Empty tile: pick a summon to station (pay its cost) or skip.',
   grid(phone('phone-claim', 'Empty tile'), phone('phone-claim-sheet', 'Claim sheet'))),
 ('pv-battle', 'Battle', 'Enemy tile: pick an attacker (live preview on the board) or retreat. Matchups show as gold glow (2×) or red tint (½×) with a banner on the sheet. Both players then see a personal result.',
   grid(phone('phone-battle', 'Enemy tile'), phone('phone-battle-sheet', 'Attacker sheet'),
        phone('phone-battle-result', 'Result — attacker'), phone('phone-battle-result-def', 'Result — defender'))),
 ('pv-own', 'Your own tile', 'Heal, sacrifice, change element, or swap in a summon from your hand.',
   grid(phone('phone-own', 'Own tile actions'), phone('phone-own-swap-sheet', 'Swap sheet'))),
 ('pv-special', 'Special tiles', 'Temple (trade for an Ascendant), Healing Spring and Treasure Chest.',
   grid(phone('phone-temple', 'Temple offers'), phone('phone-temple-sheet', 'Ascendant sheet'), phone('phone-heal', 'Healing Spring'), phone('phone-chest', 'Treasure Chest'))),
 ('pv-stalemate', 'Stalemate', 'Next turn after a stalemate: battle again or walk away for 8✦.',
   grid(phone('phone-stalemate', 'Stalemate'))),
 ('pv-wild', 'Wild cards', 'Pick one of three tier cards (or skip), reveal, choose a target. Targeted players get a full-screen notice with a Dismiss button.',
   grid(phone('phone-wildcard-pick', 'Pick a card'), phone('phone-wildcard-reveal', 'Reveal'), phone('phone-wildcard-target', 'Choose target'), phone('phone-wildcard-notification', 'Targeted notice'))),
 ('pv-menu', 'Menu, sound & leaving', '☰ in the status bar (or floating ☰ where the status bar is hidden): sound settings, how to play, leave game.',
   grid(phone('phone-menu', 'Menu'), phone('phone-sound-settings', 'Sound settings'), phone('phone-leave-confirm', 'Leave confirmation'), phone('phone-left-game', 'After leaving'))),
 ('pv-end', 'Eliminated & game over', '',
   grid(phone('phone-eliminated', 'Eliminated'), phone('phone-gameover', 'Game over'))),
 ('pv-detail', 'Card detail sheet', 'Tapping any card opens the shared detail sheet: stats, HP, type matchup, ability and lore. Swipe for the next card.',
   grid(phone('phone-card-detail', 'Standard card'), phone('phone-card-detail-rare', 'Rare card'))),
]
nav('Phone view', [(i, t) for i, t, _, _ in pv])
for i, t, intro, body in pv:
    S.append(section(i, 'Phone — ' + t, intro, body))

# Cards
cv = [
 ('cards-anatomy', 'Card states', 'One illustrated card per monster, reused everywhere. Type is the coloured frame + label; the stat strip shows HP bar, ATK, DEF, Gen and cost.',
   cards('cards-states', 'States', 'default, selected, 2× matchup glow, ½× weak tint, low HP with Battle Charm, locked Ascendant') +
   cards('cards-board', 'Board card', 'smaller card used for stationed summons and battle overlays (renderBoardCard)') +
   cards('cards-mini', 'Mini card', 'hand strip')),
]
for el in ['Light', 'Dark', 'Arcane', 'Undead', 'Beast', 'Nature']:
    cv.append(('cards-' + el.lower(), el, '', cards('cards-' + el.lower(), el + ' — 7 cards', '2 Assailants, Guardian, 3 Vanguards, Ascendant')))
cv.append(('cards-rare', 'Rares', 'Dual-element; shop ~10%.', cards('cards-rare', 'Dual-element rares')))
cv.append(('cards-support', 'Support', 'Neutral; shop ~10%; passive effects.', cards('cards-support', 'Support cards')))
nav('Cards', [(i, t) for i, t, _, _ in cv])
for i, t, intro, body in cv:
    S.append(section(i, 'Cards — ' + t, intro, body))

# Reference
phases = '''<table class="elem-table"><thead><tr><th>Phase</th><th>Who acts</th><th>Notes</th></tr></thead><tbody>
<tr><td>lobby</td><td>Host</td><td>Players join; host picks round limit and starts.</td></tr>
<tr><td>setup</td><td>Current player</td><td>3 rounds × N players; free placement (<code>setup_claim</code> / <code>setup_pass</code>).</td></tr>
<tr><td>resolve:turn_summary</td><td>Current player</td><td>Round 2+: board tally → <code>tally_complete</code> → summary → <code>dismiss_turn_summary</code>.</td></tr>
<tr><td>stalemate</td><td>Current player</td><td>Only if they left a stalemate: <code>stalemate_fight</code> / <code>stalemate_continue</code>.</td></tr>
<tr><td>shop</td><td>Current player</td><td><code>buy</code> / <code>sell</code> / <code>skip_shop</code>.</td></tr>
<tr><td>roll → resolve:landing</td><td>Current player</td><td><code>roll</code>, then <code>choose_landing</code> (3 options).</td></tr>
<tr><td>resolve:claim / battle / own / temple / heal_tile / chest / well</td><td>Current player</td><td>Landing outcomes; <code>resolve:well</code> auto-advances after 1.5 s.</td></tr>
<tr><td>resolve:battle_result</td><td>—</td><td>Held 3.5 s (longer with ability callouts), then the turn advances.</td></tr>
<tr><td>resolve:wildcard_*</td><td>Current player</td><td>After the turn if the roll passed the Mana Well: cards → target / coup / shatter.</td></tr>
<tr><td>resolve:round_callout</td><td>Board</td><td>Before penultimate/final round; board sends <code>round_callout_complete</code>.</td></tr>
<tr><td>game_over</td><td>Host</td><td>Final standings; New Game returns to lobby.</td></tr></tbody></table>'''
S.append(section('ref-phases', 'Reference — Phases', 'Server-driven; <code>G.phase</code>.', phases))
for key, title in [('actions', 'Actions'), ('ability-ref', 'Abilities'), ('ascendants', 'Ascendants'), ('wildcards-ref', 'Wild cards')]:
    body = frag[key]
    body = body[body.index('</div>') + 6: body.rindex('</section>')]  # strip old title
    S.append(section('ref-' + key, 'Reference — ' + title, '', body))
econ = '''<table class="elem-table"><thead><tr><th>Item</th><th>Value</th><th>Notes</th></tr></thead><tbody>
<tr><td>Starting Mana</td><td>40✦</td><td>Starting hand: 5 summons from a starter set</td></tr>
<tr><td>Baseline income</td><td>+5✦ / turn</td><td>From round 2, plus each stationed summon's Gen</td></tr>
<tr><td>Tile upkeep</td><td>−1✦ per owned tile</td><td>Each turn from round 2</td></tr>
<tr><td>Spell Wraith drain</td><td>−base Gen per adjacent summon</td><td>Goes to the Wraith's owner</td></tr>
<tr><td>Soft cap</td><td>150✦</td><td>Income halved (min 5) at or above</td></tr>
<tr><td>Costs</td><td>Assailant 8 · Vanguard 10 · Guardian 12 · Support 12 · Ascendant 20 · Rare 25–27</td><td>Sell refund = cost × HP/maxHP</td></tr>
<tr><td>Retreat / walk away</td><td>up to 8✦</td><td>Battle retreat or leaving a stalemate</td></tr>
<tr><td>Own tile</td><td>Heal 5✦ (up to 20 HP) · Change element 18✦ · Sacrifice +15✦</td><td>Swap = pay the new summon's cost</td></tr>
<tr><td>Healing Spring</td><td>10✦</td><td>+10 HP to all your stationed + hand summons</td></tr>
<tr><td>Mana Well</td><td>+40✦</td><td>On landing</td></tr>
<tr><td>Battle Mana</td><td>Win +4/−4 · Lose −8/+4 · Mutual −8/+4 · Stalemate −4/+4</td><td>Attacker / defender</td></tr>
<tr><td>Wild cards</td><td>Iron 15 · Arcane 30 · Gilded 60</td><td>Skip is free</td></tr>
<tr><td>Round limit</td><td>10 / 20 / 30 (default 20)</td><td>5+ players → 10</td></tr></tbody></table>'''
S.append(section('ref-economy', 'Reference — Economy', 'Matches <code>CLAUDE.md</code> (server v1.0.98).', econ))
nav('Reference', [('ref-phases', 'Phases'), ('ref-actions', 'Actions'), ('ref-ability-ref', 'Abilities'), ('ref-ascendants', 'Ascendants'), ('ref-wildcards-ref', 'Wild cards'), ('ref-economy', 'Economy')])

navhtml = ''.join(f'<div class="nav-group"><div class="nav-label">{g}</div>' + ''.join(f'<a href="#{i}" data-id="{i}">{html.escape(t) if "&" not in t else t}</a>' for i, t in items) + '</div>' for g, items in NAV)

CSS = '''*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d0e1c;--surface:#151627;--surface2:#1c1e2b;--border:#272a38;--border2:#3f424d;--text:#e9e9ed;--text2:#b2b6ca;--text3:#9397ab;--text4:#75798c;--accent:#9184d9;--accent-light:#b5abfc;--accent-pale:#d2cefd;--gold:#c9a05a}
html{scroll-behavior:smooth;scroll-padding-top:20px}
body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:14px;line-height:1.6}
a{color:var(--accent-light)}
#nav{position:fixed;top:0;left:0;width:230px;height:100vh;overflow-y:auto;background:#09091a;border-right:1px solid var(--border);padding:22px 0 40px}
#nav .brand{font-family:'Cinzel',serif;font-weight:700;letter-spacing:.12em;color:var(--gold);font-size:14px;padding:0 18px}
#nav .brand-sub{font-size:10px;color:var(--text4);padding:4px 18px 14px;border-bottom:1px solid var(--border);margin-bottom:8px}
.nav-label{font-size:10px;font-weight:600;color:var(--text4);letter-spacing:.16em;text-transform:uppercase;padding:12px 18px 4px}
#nav a{display:block;padding:4px 18px;font-size:12.5px;color:var(--text3);text-decoration:none;border-left:2px solid transparent}
#nav a:hover{color:var(--text);background:rgba(145,132,217,.07)}
#nav a.active{color:var(--accent-pale);border-left-color:var(--accent);background:rgba(145,132,217,.12)}
main{margin-left:230px;padding:44px 52px 120px;max-width:1340px}
.page-title{font-family:'Cinzel',serif;font-size:34px;font-weight:700;letter-spacing:.1em;color:var(--gold)}
.page-sub{color:var(--text3);font-size:13px;margin:6px 0 40px}
.section{margin-bottom:76px}
.section-title{font-family:'Cinzel',serif;font-size:21px;font-weight:600;letter-spacing:.06em;border-bottom:1px solid var(--border2);padding-bottom:10px;margin-bottom:14px}
.intro{color:var(--text2);max-width:820px;margin-bottom:22px}
.note{color:var(--text3);font-size:12.5px;margin:-4px 0 12px;max-width:820px}
.sub{font-size:12px;font-weight:600;color:var(--accent-light);text-transform:uppercase;letter-spacing:.12em;margin:26px 0 12px}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--accent-pale);background:rgba(145,132,217,.12);padding:1px 5px;border-radius:4px}
.shot{margin:0 0 26px}
.shot img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--border2);background:#000}
.shot.board{max-width:1180px}
.shot.cards img{width:auto;max-width:100%;border-radius:8px}
.shot figcaption{font-size:12.5px;color:var(--text3);margin-top:8px}
.shot figcaption b{color:var(--text);font-weight:600}
.phone-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:26px 22px}
.shot.phone{margin:0}
.shot.phone img{border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.shot.phone figcaption span{display:block;color:var(--text4);font-size:11.5px}
.hero{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1.4fr);gap:24px;align-items:start}
.hero-phones{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.swatch-row{display:flex;flex-wrap:wrap;gap:10px}
.swatch{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;min-width:230px}
.swatch-dot{width:30px;height:30px;border-radius:6px;flex-shrink:0;border:1px solid rgba(255,255,255,.12)}
.swatch-name{font-size:12px;font-weight:600}
.swatch-hex{font-size:11px;color:var(--text4);font-family:ui-monospace,Menlo,monospace}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;vertical-align:middle}
.players{display:flex;flex-wrap:wrap;gap:18px}
.pl{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px}
.pl-c{width:44px;height:6px;border-radius:3px}
.type-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.type-row>div{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px}
.t-cinzel{font-family:'Cinzel',serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:var(--gold);margin-bottom:6px}
.t-inter{font-size:20px;margin-bottom:6px}
.elem-table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:18px}
.elem-table th{text-align:left;padding:8px 10px;font-size:10px;font-weight:600;color:var(--text4);text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid var(--border2)}
.elem-table td{padding:8px 10px;border-bottom:1px solid var(--border);color:var(--text2);vertical-align:top}
.elem-table td:first-child{color:var(--text);font-weight:500;white-space:nowrap}
@media (max-width:900px){#nav{display:none}main{margin-left:0;padding:24px 16px}.hero,.type-row{grid-template-columns:1fr}}
'''
JS = '''const links=[...document.querySelectorAll('#nav a')];const secs=links.map(a=>document.getElementById(a.dataset.id)).filter(Boolean);
function upd(){let cur=secs[0];for(const s of secs){if(s.getBoundingClientRect().top<140)cur=s;}links.forEach(a=>a.classList.toggle('active',cur&&a.dataset.id===cur.id));}
addEventListener('scroll',upd,{passive:true});upd();'''

doc = f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Summoner's Gambit — Visual Design Reference</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@400;500;600&display=swap">
<style>{CSS}</style></head><body>
<nav id="nav"><div class="brand">Summoners Gambit</div><div class="brand-sub">Visual design reference<br>{VERS}</div>{navhtml}</nav>
<main>
<div class="page-title">Visual Design Reference</div>
<div class="page-sub">Summoner's Gambit · {VERS} · screenshots captured {DATE} from the live build · open from <code>public/</code> (images live in <code>public/img/docs/</code>)</div>
{''.join(S)}
</main><script>{JS}</script></body></html>'''
open(OUTHTML, 'w').write(doc)
print('images', len(sizes), 'total MB', round(sum(sizes.values()) / 1e6, 2), 'html KB', round(len(doc) / 1e3))

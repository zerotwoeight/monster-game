import {board,phone,shot,sleep,room,push,S,errs,b} from './h.mjs';
const R=S.ROSTER.map((m,i)=>({...m,iid:1000+i}));
const groups=[['Light'],['Dark'],['Arcane'],['Undead'],['Beast'],['Nature']];
const c=await b.newContext({viewport:{width:1300,height:900},deviceScaleFactor:2});
await c.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
await c.route(/lottie|qrcode/,r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:3919/player'); await sleep(800);
async function gallery(name,list,opts={}){
  await p.evaluate(([list,opts])=>{
    document.body.innerHTML=`<div id="gal" style="display:flex;flex-wrap:wrap;gap:22px;padding:30px;background:#0d0e1c;width:max-content;max-width:1240px">${list.map(m=>`<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${renderCard(m,opts)}<div style="font:500 11px Inter;color:#9397ab">${m.name}</div></div>`).join('')}</div>`;
    document.body.style.background='#0d0e1c';
  },[list,opts]); await sleep(900);
  await (await p.$('#gal')).screenshot({path:'shots/'+name+'.png'}); console.log('shot',name);
}
for(const [el] of groups) await gallery('cards-'+el.toLowerCase(), R.filter(m=>m.type===el && !m.type2 && m.rarity!=='support'));
await gallery('cards-rare', R.filter(m=>m.rarity==='rare'));
await gallery('cards-support', R.filter(m=>m.rarity==='support'));
await gallery('cards-mini', R.filter(m=>!m.rarity).filter((m,i)=>i%3===0), {size:'mini'});
// states
const dk=R.find(m=>m.id==='death_knight'), ds=R.find(m=>m.id==='dawn_striker'), dl=R.find(m=>m.id==='demon_lord');
await p.evaluate(([dk,ds,dl])=>{
  const lab=(t)=>`<div style="font:500 11px Inter;color:#9397ab;text-align:center;max-width:150px">${t}</div>`;
  const col=(h,t)=>`<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${h}${lab(t)}</div>`;
  document.body.innerHTML=`<div id="gal" style="display:flex;gap:22px;padding:30px;background:#0d0e1c;width:max-content">
   ${col(renderCard(ds),'Default')}
   ${col(renderCard(ds,{selected:true}),'Selected')}
   ${col(renderCard(ds,{typeAdvantage:true}),'2× strong matchup')}
   ${col(renderCard(dk,{typeWeak:true}),'½× weak matchup')}
   ${col(renderCard({...dk,hp:9,charm:true}),'Low HP + Battle Charm')}
   ${col(renderCard({...dl,canUse:false,conditionDesc:'Had 2+ summons destroyed in battle this game'},{dim:true}),'Ascendant locked')}
  </div>`; },[dk,ds,dl]); await sleep(900);
await (await p.$('#gal')).screenshot({path:'shots/cards-states.png'}); console.log('shot cards-states');
// card detail sheet (real overlay) on phone
const ph=await phone('ph'); await sleep(800);
await ph.evaluate((list)=>{ openDetailSheet(list,0,()=>null,{title:'Your Hand'}); },[R.find(m=>m.id==='stormtalon'),R.find(m=>m.id==='luminar_operative'),R.find(m=>m.id==='red_dragon')]);
await sleep(900); await shot(ph,'phone-card-detail');
await ph.evaluate(()=>{ closeCardDetail(); }); 
await ph.evaluate((m)=>{ openDetailSheet([m],0,()=>null,{title:'Card'}); },R.find(m=>m.id==='luminar_operative')); await sleep(800); await shot(ph,'phone-card-detail-rare');
// board cards
const B=await board(); await sleep(1200);
await B.evaluate((list)=>{ document.body.innerHTML=`<div id="gal" style="display:flex;gap:26px;padding:30px;background:#0d0e1c;width:max-content">${list.map(m=>renderBoardCard(m)).join('')}</div>`; },[ds,dk,dl,R.find(m=>m.id==='hex_stalker'),R.find(m=>m.id==='forge')]);
await sleep(900); await (await B.$('#gal')).screenshot({path:'shots/cards-board.png'}); console.log('shot cards-board');
console.log(errs.slice(0,5)); await b.close(); process.exit(0);

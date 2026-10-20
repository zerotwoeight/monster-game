import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { createRequire } from 'module'; import fs from 'fs';
const require=createRequire(import.meta.url);
process.chdir('/tmp/claude-0/-home-claude/80ffb261-b521-5093-9698-9a7338a1081e/scratchpad/game');
const S=require('./srv_doc.js');
await new Promise(r=>S.server.listen(3919,'127.0.0.1',r));
const LOT=fs.readFileSync('/tmp/claude-0/fonts/lw/build/player/lottie.min.js'), QR=fs.readFileSync('/tmp/claude-0/fonts/qr/qrcode.min.js');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
async function route(ctx){ await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route(/lottie/,r=>r.fulfill({status:200,contentType:'application/javascript',body:LOT}));
  await ctx.route(/qrcode/,r=>r.fulfill({status:200,contentType:'application/javascript',body:QR})); }
const errs=[];
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function board(){ const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}); await route(c); const p=await c.newPage(); p.on('pageerror',e=>errs.push('board:'+e.message)); await p.goto('http://127.0.0.1:3919/board'); return p; }
export async function phone(tag){ const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}); await route(c); const p=await c.newPage(); p.on('pageerror',e=>errs.push(tag+':'+e.message)); await p.goto('http://127.0.0.1:3919/player'); return p; }
export async function shot(p,name,opts={}){ await p.screenshot({path:'/tmp/claude-0/-home-claude/80ffb261-b521-5093-9698-9a7338a1081e/scratchpad/game/shots/'+name+'.png',...opts}); console.log('shot',name); }
export const room=()=>{ const r=[...S.rooms.values()][0]; S.setG(r); return r; };
export const push=()=>{ room(); S.broadcast(); };
export { S, errs, b };
export async function bootGame({setupPlan=[[3,9,17],[5,12,24],[19,26,10]]}={}){
  const B=await board(); await sleep(1500); await B.mouse.click(5,5);
  const code=room().roomCode; const P=[]; const names=['Aria','Bram','Cyra']; const sets=['C','B','F'];
  for(let i=0;i<3;i++){ const p=await phone('p'+i); await sleep(500);
    await p.evaluate(([n,c,s])=>send('join',{name:n,roomCode:c,starterSet:s}),[names[i],code,sets[i]]); await sleep(300); P.push(p); }
  await B.evaluate(()=>send('start_game',{roundLimit:10})); await sleep(1000);
  for(const p of P) await p.evaluate(()=>{_setupClaimSeen=true; render();});
  for(let r=0;r<3;r++) for(let i=0;i<3;i++){ const g=room(); const cur=g.currentPlayer; const pl=g.players[cur];
    await P[cur].evaluate(([iid,t])=>send('setup_claim',{iid,tilePos:t}),[pl.hand[0].iid,setupPlan[cur][r]]); await sleep(350); }
  await sleep(1200); return {B,P};
}
export const act=(p,a,d={})=>p.evaluate(([a,d])=>send(a,d),[a,d]);

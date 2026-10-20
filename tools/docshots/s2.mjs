import {board,phone,shot,sleep,room,push,S,errs,b} from './h.mjs';
const B=await board(); await sleep(1500); await B.mouse.click(5,5);
const code=room().roomCode;
const P=[]; const names=['Aria','Bram','Cyra']; const sets=['C','B','F'];
for(let i=0;i<3;i++){ const p=await phone('p'+i); await sleep(600);
  await p.evaluate(([n,c,s])=>send('join',{name:n,roomCode:c,starterSet:s}),[names[i],code,sets[i]]); await sleep(400); P.push(p); }
await B.evaluate(()=>send('start_game',{roundLimit:10})); await sleep(1200);
await shot(P[0],'phone-setup-instructions');
for(const p of P) await p.evaluate(()=>{_setupClaimSeen=true; render();});
await sleep(800);
await shot(P[0],'phone-setup-ring'); await shot(P[1],'phone-setup-waiting');
await P[0].evaluate(()=>openSetupClaimDetail(0)); await sleep(700); await shot(P[0],'phone-setup-claim-sheet');
await P[0].evaluate(()=>closeCardDetail());
// scripted setup claims
const plan=[[3,9,17],[5,12,24],[19,26,10]]; // per player tiles over 3 rounds (elemental positions)
for(let r=0;r<3;r++) for(let i=0;i<3;i++){
  const g=room(); const cur=g.currentPlayer; const pl=g.players[cur];
  const tile=plan[cur][r];
  await P[cur].evaluate(([iid,t])=>send('setup_claim',{iid,tilePos:t}),[pl.hand[0].iid,tile]);
  await sleep(500);
  if(r===1&&i===1){ await shot(B,'board-setup'); }
}
await sleep(1500);
console.log('phase',room().phase,'cur',room().currentPlayer);
fs_save();
function fs_save(){}
console.log(errs.slice(0,5)); await b.close(); process.exit(0);

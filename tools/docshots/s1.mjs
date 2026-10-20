import {board,phone,shot,sleep,room,push,S,errs,b} from './h.mjs';
const B=await board(); await sleep(1500);
await B.mouse.click(5,5); // unlock audio
const code=room().roomCode;
await shot(B,'board-lobby-empty');
const P=[]; const names=['Aria','Bram','Cyra']; const sets=['C','B','F'];
for(let i=0;i<3;i++){ const p=await phone('p'+i); await sleep(700); if(i===0) await shot(p,'phone-join');
  await p.evaluate(([n,c,s])=>send('join',{name:n,roomCode:c,starterSet:s}),[names[i],code,sets[i]]); await sleep(500); P.push(p); }
await sleep(800); await shot(P[0],'phone-lobby'); await shot(B,'board-lobby');
console.log(errs); await b.close(); process.exit(0);

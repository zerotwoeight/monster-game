import {bootGame,act,shot,sleep,room,push,S,errs,b} from './h.mjs';
const {B,P}=await bootGame();
const g=()=>room();
// ── Aria (0) turn: shop
await sleep(500);
await shot(P[0],'phone-shop'); await shot(B,'board-turn');
await P[0].evaluate(()=>openShopDetail('buy',0)); await sleep(700); await shot(P[0],'phone-shop-sheet');
await P[0].evaluate(()=>closeCardDetail());
await shot(P[1],'phone-waiting-ring');
await act(P[0],'skip_shop'); await sleep(800); await shot(P[0],'phone-roll');
await act(P[0],'roll'); await sleep(400);
// steer landing options: empty tile, enemy tile (Bram @5), own tile (3)
{ const G=g(); const pos=G.players[0].position; G.pendingLanding.options=[4,5,6]; push(); }
await sleep(3500); await shot(P[0],'phone-landing'); await shot(B,'board-landing');
await P[0].evaluate(()=>openLandingDetail(1)); await sleep(700); await shot(P[0],'phone-landing-sheet');
await P[0].evaluate(()=>closeCardDetail());
await act(P[0],'choose_landing',{tilePos:4}); await sleep(2500);
await shot(P[0],'phone-claim'); 
await P[0].evaluate(()=>openClaimDetail(0)); await sleep(700); await shot(P[0],'phone-claim-sheet');
await P[0].evaluate(()=>closeCardDetail());
{ const pl=g().players[0]; await act(P[0],'claim',{iid:pl.hand[0].iid}); }
await sleep(2500);
console.log('phase',g().phase,'cur',g().currentPlayer);
// ── Bram (1) turn → battle on Aria's tile 3
await act(P[1],'skip_shop'); await sleep(600); await act(P[1],'roll'); await sleep(300);
{ const G=g(); G.pendingLanding.options=[3,4,9]; push(); }
await sleep(3500); await act(P[1],'choose_landing',{tilePos:3}); await sleep(2500);
console.log('phase',g().phase);
await shot(P[1],'phone-battle'); 
await P[1].evaluate(()=>openBattleDetail(0)); await sleep(1200); await shot(P[1],'phone-battle-sheet'); await shot(B,'board-battle-preview');
await P[1].evaluate(()=>closeCardDetail()); await sleep(300);
{ const pl=g().players[1]; await act(P[1],'attack',{iid:pl.hand[0].iid}); }
await sleep(1700); await shot(B,'board-battle-anim1'); await sleep(1600); await shot(B,'board-battle-anim2');
await sleep(1500); await shot(B,'board-battle-result'); await shot(P[1],'phone-battle-result'); await shot(P[0],'phone-battle-result-def');
console.log('outcome',g().lastBattle&&g().lastBattle.outcome);
console.log(errs.slice(0,5)); await b.close(); process.exit(0);

import {bootGame,act,shot,sleep,room,push,S,errs,b} from './h.mjs';
const {B,P}=await bootGame();
const g=()=>room();
async function moveTo(i,tile,{skip=true}={}){ if(skip){await act(P[i],'skip_shop'); await sleep(500);} await act(P[i],'roll'); await sleep(300);
  const G=g(); G.pendingLanding.options=[tile,(tile+1)%28,(tile+2)%28].map(x=>x); G.pendingLanding.options[0]=tile; push(); await sleep(3300);
  await act(P[i],'choose_landing',{tilePos:tile}); await sleep(2600); }
// Aria → own tile 3
await moveTo(0,3); console.log('A',g().phase); await shot(P[0],'phone-own'); 
await P[0].evaluate(()=>openSwapDetail(0)); await sleep(700); await shot(P[0],'phone-own-swap-sheet'); await P[0].evaluate(()=>closeCardDetail());
await act(P[0],'skip_own'); await sleep(1500);
// Bram → temple 21
{ g().players[1].position=18; }
await moveTo(1,21); console.log('B',g().phase); await shot(P[1],'phone-temple');
await P[1].evaluate(()=>openTempleOfferDetail(0)); await sleep(700); await shot(P[1],'phone-temple-sheet'); await P[1].evaluate(()=>closeCardDetail());
await act(P[1],'temple_leave'); await sleep(1500);
// Cyra → heal 14
{ g().players[2].position=10; }
await moveTo(2,14); console.log('C',g().phase); await shot(P[2],'phone-heal'); await act(P[2],'heal_tile_skip'); await sleep(1500);
// Round 2: Aria turn summary w/ tally
console.log('R2',g().phase,g().currentPlayer);
await sleep(1200); await shot(B,'board-tally'); await sleep(4000);
await shot(P[0],'phone-turn-summary'); await shot(B,'board-turn-summary');
await act(P[0],'dismiss_turn_summary'); await sleep(1500);
// Aria → chest 7, with wild card pending
{ g().players[0].position=4; }
await act(P[0],'skip_shop'); await sleep(400); await act(P[0],'roll'); await sleep(300);
{ const G=g(); G.pendingLanding.options=[7,8,9]; push(); } await sleep(3300);
await act(P[0],'choose_landing',{tilePos:7}); await sleep(2600); console.log('chest',g().phase, g().pendingChest&&g().pendingChest.kind);
await shot(P[0],'phone-chest');
{ const G=g(); G.pendingWildCard=true; G.wildCardDrawn=null; }
{ const pc=g().pendingChest, pl=g().players[0]; const st=g().board.find(t=>t.ownerId===0&&t.summonInstance);
  if(pc.kind==='potion') await act(P[0],'chest_apply_potion',{iid:st.summonInstance.iid});
  else if(pc.kind==='charm') await act(P[0],'chest_assign_charm',{iid:st.summonInstance.iid});
  else if(pc.kind==='warp') await act(P[0],'chest_discard'); else await act(P[0],'chest_skip'); }
await sleep(2500); console.log('wc',g().phase);
if(g().phase==='resolve:wildcard_cards'){
  const pools=null;
  await shot(P[0],'phone-wildcard-pick'); await shot(B,'board-wildcard');
  const drawn=g().wildCardDrawn; await P[0].evaluate(()=>wcPickCard('low')); await sleep(600); await shot(P[0],'phone-wildcard-reveal');
  g().players[0].mana=200; push(); await sleep(300);
  await act(P[0],'wildcard_select',{tier:'low',cardId:drawn.low.id}); await sleep(1200); console.log('wc2',g().phase,drawn.low.id);
  if(g().phase==='resolve:wildcard_target'){ await shot(P[0],'phone-wildcard-target');
    if(drawn.low.id==='mend'){ const st=g().board.find(t=>t.ownerId===0&&t.summonInstance); await act(P[0],'wildcard_target',{targetIdx:st.pos}); }
    else await act(P[0],'wildcard_target',{targetIdx:1}); await sleep(1500); }
}
// force a notification on Bram for the shot
{ const G=g(); G.players[1].notification={cardId:'jinx',cardName:'Jinx',cardDesc:"Target player's passive mana income next turn is halved",castByName:'Aria',castByColor:'#e05252',tier:'low'}; push(); }
await sleep(1200); await shot(P[1],'phone-wildcard-notification');
await act(P[1],'dismiss_notification'); await sleep(800);
// menus on Cyra
await P[2].evaluate(()=>openGameMenu()); await sleep(500); await shot(P[2],'phone-menu');
await P[2].evaluate(()=>showAudioSettings()); await sleep(500); await shot(P[2],'phone-sound-settings');
await P[2].evaluate(()=>{openGameMenu(); showLeaveConfirm();}); await sleep(500); await shot(P[2],'phone-leave-confirm');
await P[2].evaluate(()=>closeGameMenu());
await B.evaluate(()=>openAudioSettings()); await sleep(500); await shot(B,'board-sound-settings'); await B.evaluate(()=>closeAudioSettings());
// stalemate screen for current player
{ const G=g(); const cur=G.currentPlayer; G.stalemateData={attackerIdx:cur,tilePos:3}; G.phase='stalemate'; push(); await sleep(1200); await shot(P[cur],'phone-stalemate'); G.stalemateData=null; G.phase='shop'; push(); await sleep(600); }
// round callouts on board
await B.evaluate(()=>_fireRoundCallout('penultimate')); await sleep(700); await shot(B,'board-callout-penultimate'); await sleep(2000);
await B.evaluate(()=>_fireRoundCallout('final')); await sleep(900); await shot(B,'board-callout-final'); await sleep(2500);
// eliminated view
{ const G=g(); G.players[1].eliminated=true; push(); await sleep(900); await shot(P[1],'phone-eliminated'); G.players[1].eliminated=false; push(); }
// left-game view
await P[1].evaluate(()=>{_leftGame=true; renderLeftGame();}); await sleep(400); await shot(P[1],'phone-left-game'); await P[1].evaluate(()=>{_leftGame=false; render();});
// pause overlay: disconnect Cyra
await P[2].context().close(); await sleep(1500); await shot(B,'board-paused'); 
await B.evaluate(()=>dcoRemoveClick()); await sleep(300); await shot(B,'board-paused-armed');
await B.evaluate(()=>dcoRemoveClick()); await sleep(1500);
// game over
S.endGame(); push(); await sleep(2500); await shot(B,'board-gameover-fanfare'); await sleep(6000); await shot(B,'board-gameover'); await shot(P[0],'phone-gameover');
console.log(errs.slice(0,8)); await b.close(); process.exit(0);

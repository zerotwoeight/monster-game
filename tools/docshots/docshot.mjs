import {b,errs,sleep} from './h.mjs';
const c=await b.newContext({viewport:{width:1440,height:900}}); await c.route(/fonts\.(googleapis|gstatic)/,r=>r.fulfill({status:200,contentType:'text/css',body:''}));
const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); const bad=[]; p.on('response',r=>{if(r.status()>=400)bad.push(r.url())});
await p.goto('http://127.0.0.1:3919/summoners-gambit-design-doc.html',{waitUntil:'load'});
for(const id of ['overview','tokens','bv-battle','pv-battle','pv-wild','cards-anatomy','ref-actions']){ await p.evaluate(i=>document.getElementById(i).scrollIntoView(),id); await sleep(900); await p.screenshot({path:'/tmp/claude-0/doc-'+id+'.png'}); }
const h=await p.evaluate(()=>document.body.scrollHeight); console.log('height',h,'bad',bad.length,bad.slice(0,3),errs);
const imgs=await p.evaluate(()=>[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length); console.log('broken imgs',imgs);
await b.close(); process.exit(0);

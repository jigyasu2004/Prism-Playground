import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.mjs';
import {games} from '../public/registry.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const app=createApp({local:true,dbPath:resolve('artifacts/test-db-flows-'+Date.now()+'.sqlite'),origin:'http://127.0.0.1:4320'});
await new Promise(r=>app.server.listen(4320,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
const reportPath='artifacts/browser-flows-report.json';const prior=process.env.FLOW_RESUME&&existsSync(reportPath)?JSON.parse(readFileSync(reportPath)):null;const results=prior?.results||[],failures=[];const flush=()=>writeFileSync(reportPath,JSON.stringify({results,failures},null,2));
const puzzles=['relay','twin','pulse','lantern','parcel','gravity','mirror','switchyard'];
const current=()=>app.db.prepare('SELECT * FROM runs ORDER BY started_at DESC,rowid DESC LIMIT 1').get();
const runs=()=>app.db.prepare('SELECT COUNT(*) n FROM runs').get().n;
const wallet=()=>app.db.prepare('SELECT xp,crystals FROM profiles WHERE user_id=?').get('local-owner');
async function click(page,selector){await page.locator(selector)[page.mobile?'tap':'click']();}
async function saved(page,fn){const previous=current();await fn();await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('prism-pending')||'null'));const deadline=Date.now()+8000;while(Date.now()<deadline){if(current().id!==previous.id||current().revision>previous.revision){await page.waitForTimeout(120);return current();}await page.waitForTimeout(40);}throw Error('Action was not saved');}
async function setup(page,id){await page.goto('http://127.0.0.1:4320');if(await page.locator('#leave-paused').count())await click(page,'#leave-paused');await page.getByRole('button',{name:'Play '+games[id].meta.name,exact:true})[page.mobile?'tap':'click']();if(['lumen','signal','tempo','comet'].includes(id))await page.locator('#mode').selectOption('practice');}
async function stroke(page,selector,points){const element=page.locator(selector);await element.scrollIntoViewIfNeeded();const box=await element.boundingBox();const pts=points.map(p=>({x:box.x+p.x/600*box.width,y:box.y+p.y/440*box.height}));if(page.mobile){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pts[0],id:1}]});for(const p of pts.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await page.mouse.move(pts[0].x,pts[0].y);await page.mouse.down();for(const p of pts.slice(1))await page.mouse.move(p.x,p.y,{steps:3});await page.mouse.up();}}
async function puzzleMove(page,id,move){
 if(id==='relay')await click(page,`[data-tile="${move}"]`);
 if(id==='twin'||id==='lantern')await click(page,`[data-dir="${move}"]`);
 if(id==='pulse'){await click(page,`[data-card="${move}"]`);await page.locator('#effect').getByText(/Exact result:/).waitFor();await click(page,'#use-card');}
 if(id==='parcel'){await click(page,`[data-piece="${move.piece}"]`);if(move.vertical)await click(page,'#rotate');await click(page,`[data-square="${move.p}"]`);}
 if(id==='gravity')await click(page,`[data-thrust="${move}"]`);
 if(id==='mirror')await click(page,`[data-mirror="${move}"]`);
 if(id==='switchyard'){await click(page,`[data-stack="${move.from}"]`);await click(page,`[data-stack="${move.to}"]`);}
}
async function tutorialAction(page,id){
 const g=games[id],mode=['lumen','signal','tempo','comet'].includes(id)?'practice':g.meta.modes[0],s=g.create('tutorial','normal',mode);
 if(puzzles.includes(id)){await puzzleMove(page,id,g.solve(s)[0]);assert.equal(await page.locator('.stat b').first().textContent(),'1');return;}
 if(id==='lumen'){const p=s.board.find(x=>x.type==='blue');await stroke(page,'#loom',[{x:p.x-17,y:p.y-17},{x:p.x+17,y:p.y-17},{x:p.x+17,y:p.y+17},{x:p.x-17,y:p.y+17},{x:p.x-17,y:p.y-17}]);assert.equal(await page.locator('.stat b').first().textContent(),'10');}
 if(id==='orbit'){await page.waitForTimeout(s.readyAt+120);await click(page,`[data-pos="${s.sequence[0]}"]`);assert.equal(await page.locator('.stat b').first().textContent(),'100');await page.locator('#orbit-center').getByText('1 / 2',{exact:false}).waitFor();}
 if(id==='cipher'){await click(page,'[data-feature="0"]');assert.equal(await page.locator('.stat b').first().textContent(),'1');assert.match(await page.locator('.message').textContent(),/New evidence/);}
 if(id==='signal'){if(await page.locator('#ack').count())await click(page,'#ack');await click(page,`[data-bin="${g.answer(s)}"]`);assert.ok(Number(await page.locator('.stat b').first().textContent())>0);}
 if(id==='tempo'){const note=s.notes[0];await click(page,note.rest?'#skip-rest':`[data-lane="${note.lane}"]`);assert.ok(Number(await page.locator('.stat b').first().textContent())>0);}
 if(id==='comet'){const target=g.target(s,0),el=page.locator('#comet-field');await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();const x=b.x+target.x/600*b.width,y=b.y+target.y/440*b.height;if(page.mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);assert.ok(Number(await page.locator('.stat b').first().textContent())>0);}
 if(id==='stillwater'){const [a,b]=s.points;await stroke(page,'#water',[a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},b]);assert.equal(await page.locator('.stat b').first().textContent(),'1');assert.match(await page.locator('.message').textContent(),/clear path/i);}
 if(id==='recall'){await click(page,'#hide-memory');await click(page,'[data-symbol="0"]');await click(page,`[data-memory-cell="${s.answer[0]}"]`);assert.ok((await page.locator(`[data-memory-cell="${s.answer[0]}"]`).textContent()).includes(g.symbols[0]));}
}
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
  const page=await context.newPage();page.mobile=mobile;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const id of Object.keys(games)){
   if(results.some(r=>r.game===id&&r.device===(mobile?'touch':'desktop')&&r.flow.startsWith('interactive')))continue;
   try{
    await setup(page,id);const count=runs(),balance=wallet();await click(page,'#try');await page.locator('#field').waitFor();
    await tutorialAction(page,id);assert.equal(runs(),count,'Tutorial creates no persisted run');assert.deepEqual(wallet(),balance,'Tutorial never awards currency');
    if(await page.locator('#again').count())await click(page,'#again');else await click(page,'#restart');
    await page.locator('#real').waitFor();assert.equal(await page.locator('.stat b').first().textContent(),'0');
    await page.waitForTimeout(1100);const beforePause=await page.locator('#timer').textContent();await click(page,'#pause');await page.locator('#resume').waitFor();await page.waitForTimeout(80);const frozen=await page.locator('#timer').textContent();
    assert.ok(frozen>=beforePause,'Tutorial pause retains elapsed time');await page.waitForTimeout(1100);assert.equal(await page.locator('#timer').textContent(),frozen);await click(page,'#resume');await page.locator('#pause').waitFor();await page.waitForTimeout(80);assert.ok((await page.locator('#timer').textContent())>=frozen,'Tutorial resume cannot reset time');
    await click(page,'#exit');await page.getByRole('button',{name:'Play '+games[id].meta.name,exact:true}).waitFor();assert.equal(runs(),count);
    await setup(page,id);await click(page,'#begin');await page.locator('#field').waitFor();const first=current();
    await saved(page,()=>click(page,'#pause'));assert.equal(current().active_since,null);
    await saved(page,()=>click(page,'#resume'));assert.notEqual(current().active_since,null);
    await saved(page,()=>click(page,'#restart'));const restarted=current();assert.notEqual(first.id,restarted.id);assert.equal(first.seed,restarted.seed);
    assert.equal(app.db.prepare('SELECT status FROM runs WHERE id=?').get(first.id).status,'abandoned');
    await saved(page,()=>click(page,'#exit'));assert.equal(current().status,'abandoned');assert.equal(JSON.parse(current().reward).xp,0);
    assert.equal(errors.length,0,errors.join('\n'));results.push({game:id,device:mobile?'touch':'desktop',flow:'interactive tutorial action, tutorial restart/pause/resume/exit, real start/pause/resume/restart/exit',status:'PASSED'});flush();console.log('PASS',mobile?'touch':'desktop','tutorial and lifecycle',id);
   }catch(e){failures.push({game:id,device:mobile?'touch':'desktop',flow:'tutorial/lifecycle',error:e.message});await page.screenshot({path:`artifacts/FAIL-flows-${id}-${mobile?'touch':'desktop'}.png`,fullPage:true});throw e;}
  }
  for(const id of puzzles){
   if(results.some(r=>r.game===id&&r.device===(mobile?'touch':'desktop')&&r.flow.startsWith('hint,')))continue;
   try{
    let state,path;for(let tries=0;tries<20;tries++){await setup(page,id);await click(page,'#begin');await page.locator('#field').waitFor();state=JSON.parse(current().state);path=games[id].solve(state);if(path.length>1)break;await saved(page,()=>click(page,'#exit'));}
    assert.ok(path.length>1,'Need a nonterminal first move to verify undo');
    const before=structuredClone(state);await saved(page,()=>click(page,'#hint'));const hinted=JSON.parse(current().state);assert.equal(current().assisted,1);assert.ok(hinted.hint!==null);delete hinted.hint;hinted.message=before.message;assert.deepEqual(hinted,before,'Hint must preserve the complete game state');
    await saved(page,()=>puzzleMove(page,id,path[0]));const after=JSON.parse(current().state);assert.equal(after.moves,1);const restored=structuredClone(after);games[id].undo(restored);
    await saved(page,()=>click(page,'#undo'));assert.deepEqual(JSON.parse(current().state),restored,'Undo restores the board and retains its move cost');assert.equal(current().assisted,1);
    await saved(page,()=>click(page,'#restart'));assert.equal(current().assisted,1,'Restart preserves assistance');assert.equal(JSON.parse(current().state).moves,0);
    await saved(page,()=>click(page,'#exit'));assert.equal(current().status,'abandoned');
    results.push({game:id,device:mobile?'touch':'desktop',flow:'hint, legal move, undo, assisted restart, exit',status:'PASSED'});flush();console.log('PASS',mobile?'touch':'desktop','hint/undo',id);
   }catch(e){failures.push({game:id,device:mobile?'touch':'desktop',flow:'hint/undo',error:e.message});await page.screenshot({path:`artifacts/FAIL-hint-${id}-${mobile?'touch':'desktop'}.png`,fullPage:true});throw e;}
  }
  await context.close();
 }
}finally{
 writeFileSync('artifacts/browser-flows-report.json',JSON.stringify({results,failures},null,2));await browser.close();await app.close();
}
assert.equal(failures.length,0);console.log(`${results.length} interactive tutorial/lifecycle and puzzle-control checks passed.`);

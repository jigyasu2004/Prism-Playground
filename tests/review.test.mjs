import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import {authSystem} from '../server/auth.mjs';
import worker from '../cloud/worker.mjs';
import {games,roster} from '../public/registry.mjs';
import {hash} from '../public/core.mjs';

async function fixture(kind,{beforeBatch}={}){
 const dir=mkdtempSync(join(tmpdir(),'prism-review-'));let app,sql,env;
 if(kind==='Node'){
  app=createApp({local:true,dbPath:join(dir,'db.sqlite')});sql=app.db;
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 }else{
  sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;');
  const migrations=new URL('../drizzle/',import.meta.url);
  for(const name of readdirSync(migrations).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,migrations),'utf8'));
  function prepare(query,args=[]){return {query,args,bind(...values){return prepare(query,values);},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}
  env={DB:{prepare,async batch(statements){await beforeBatch?.(statements);sql.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>({meta:{changes:Number(sql.prepare(s.query).run(...s.args).changes)}}));sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}},ASSETS:{fetch:async()=>new Response('asset')}};
 }
 const user=kind==='Node'?'local-owner':'review-owner';
 return {sql,user,async call(path,body){const headers={...(body?{'content-type':'application/json'}:{}),...(kind==='D1'?{'oai-authenticated-user-id':user}:{})};const args={method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined};const res=kind==='Node'?await fetch(`http://127.0.0.1:${app.server.address().port}${path}`,args):await worker.fetch(new Request('https://private.example'+path,args),env);return {status:res.status,data:await res.json()};},async close(){if(app)await app.close();else sql.close();rmSync(dir,{recursive:true,force:true});}};
}
const settings=(game='relay',extra={})=>({game,difficulty:'normal',mode:games[game].meta.modes[0],...extra});
test('D1: concurrent daily starts claim unassisted eligibility atomically',async()=>{
 const RealDate=Date;
 let instant=RealDate.UTC(2026,0,1,12);
 while(roster[hash(new RealDate(instant).toISOString().slice(0,10))%roster.length].id!=='cipher')instant+=86400000;
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};
 let arrivals=0,release;const gate=new Promise(resolve=>{release=resolve;});
 const f=await fixture('D1',{beforeBatch:async statements=>{
  if(!statements[0].query.startsWith('INSERT INTO runs('))return;
  arrivals++;if(arrivals===2)release();await gate;
 }});
 try{
  // Both requests finish every pre-insert read before either transaction starts.
  const attempts=await Promise.all([f.call('/api/runs',settings('cipher',{daily:true})),f.call('/api/runs',settings('cipher',{daily:true}))]);
  assert.equal(arrivals,2);assert.deepEqual(attempts.map(x=>x.status),[201,201]);
  const rows=f.sql.prepare('SELECT * FROM runs').all();assert.equal(rows.length,2);
  assert.equal(rows.filter(x=>x.assisted===0).length,1,'Only the first atomic insertion is eligible');
  const previous=rows.find(x=>x.status==='abandoned'),active=rows.find(x=>x.status==='playing');
  assert.ok(previous&&active);assert.equal(active.assisted,1);
  const disclosed=(await f.call('/api/runs/'+previous.id)).data;
  assert.equal(disclosed.seed,active.seed);
  const secret=games.cipher.create(disclosed.seed,'normal','deduction').secret;
  const finished=(await action(f,active,{type:'guess',id:secret})).data;
  assert.equal(finished.status,'completed');assert.equal(finished.assisted,1);
  assert.equal(finished.reward.xp,25);assert.equal(finished.reward.daily,0);
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM challenges WHERE challenge='daily'").get().n,0);
 }finally{await f.close();globalThis.Date=RealDate;}
});
async function action(f,r,a){const response=await f.call(`/api/runs/${r.id}/actions`,{actionId:randomUUID(),revision:r.revision,action:a});return response;}
async function start(f,b){const res=await f.call('/api/runs',b);assert.equal(res.status,201,JSON.stringify(res.data));return res.data;}

test('stored OIDC sessions recheck current issuer and subject allowlist',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires INTEGER)');
 const config={issuer:'https://identity.example',clientId:'prism',allowed:'owner',origin:'https://private.example'};
 const request={headers:{cookie:'prism_session=sid'}};
 const insert=user=>db.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?)').run('sid',user,Date.now()+86400000);
 try{
  insert(config.issuer+'|owner');assert.equal(authSystem(db,config).identify(request),config.issuer+'|owner');
  assert.equal(authSystem(db,{...config,allowed:'replacement'}).identify(request),null);
  assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n,0);
  insert(config.issuer+'|owner');assert.equal(authSystem(db,{...config,issuer:'https://new-issuer.example'}).identify(request),null);
  assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n,0);
  insert(config.issuer+'|owner');assert.equal(authSystem(db,{...config,allowed:''}).identify(request),null);
 }finally{db.close();}
});

for(const kind of ['Node','D1']){
 test(`${kind}: resume cannot roll back active time; pause/resume transitions and retries are idempotent`,async()=>{
  const f=await fixture(kind);try{
   let r=await start(f,settings('tempo'));const earlier=Date.now()-10000;
   f.sql.prepare('UPDATE runs SET active_since=? WHERE id=?').run(earlier,r.id);
   assert.equal((await action(f,r,{type:'resume'})).status,400);
   assert.equal(f.sql.prepare('SELECT active_since FROM runs WHERE id=?').get(r.id).active_since,earlier);
   const id=randomUUID(),body={actionId:id,revision:r.revision,action:{type:'pause'}};
   r=(await f.call(`/api/runs/${r.id}/actions`,body)).data;assert.ok(r.elapsed>=10000);const elapsed=r.elapsed;
   assert.equal((await f.call(`/api/runs/${r.id}/actions`,body)).data.revision,r.revision);
   assert.equal((await action(f,r,{type:'pause'})).status,400);
   r=(await action(f,r,{type:'resume'})).data;assert.ok(r.elapsed>=elapsed);
   assert.equal((await action(f,r,{type:'resume'})).status,400);
   assert.ok((await f.call('/api/runs/'+r.id)).data.elapsed>=elapsed);
  }finally{await f.close();}
 });
 test(`${kind}: replay/restart validation preserves assistance and proves daily seed provenance`,async()=>{
  const f=await fixture(kind);try{
   for(const extra of [{replaySeed:''},{replaySeed:null},{replaySeed:'known',daily:true},{restartId:randomUUID(),daily:true},{restartId:randomUUID(),replaySeed:'known'}])assert.equal((await f.call('/api/runs',settings('relay',extra))).status,400);
   let r=await start(f,settings('relay',{replaySeed:'known'}));assert.equal(r.practice,1);
   r=await start(f,settings('relay',{restartId:r.id}));assert.equal(r.practice,1);
   r=await start(f,settings());r=(await action(f,r,{type:'hint'})).data;assert.equal(r.assisted,1);
   r=await start(f,settings('relay',{restartId:r.id}));assert.equal(r.assisted,1);
   for(const i of games.relay.solve(r.state)){const next=await action(f,r,{type:'tile',i});assert.equal(next.status,200);r=next.data;}
   assert.equal(r.status,'completed');assert.ok(r.reward.xp<=25);
   assert.equal((await f.call('/api/runs',settings('relay',{restartId:r.id}))).status,400);
   r=await start(f,settings('cipher'));r=await start(f,settings('cipher',{restartId:r.id}));assert.equal(r.assisted,1);
   const day=new Date().toISOString().slice(0,10),game=roster[hash(day)%roster.length].id;
   const daily=await start(f,settings(game,{daily:true}));
   const stored=f.sql.prepare('SELECT seed FROM daily_seeds WHERE day=? AND game=?').get(day,game);
   assert.match(stored.seed,/^[a-f0-9-]{36}$/);assert.equal(daily.daily,day);
   const repeated=await start(f,settings(game,{daily:true}));assert.equal(repeated.assisted,1);assert.equal(f.sql.prepare('SELECT seed FROM runs WHERE id=?').get(repeated.id).seed,stored.seed);
   const restarted=await start(f,settings(game,{restartId:repeated.id}));assert.equal(restarted.daily,day);
   const arbitrary=await start(f,settings(game));f.sql.prepare('UPDATE runs SET daily=? WHERE id=?').run(day,arbitrary.id);
   const forged=await start(f,settings(game,{restartId:arbitrary.id}));assert.equal(forged.daily,null);
  }finally{await f.close();}
 });
 test(`${kind}: hidden games never serialize active seed material; completed replay is reduced`,async()=>{
  const f=await fixture(kind);try{
   for(const id of ['cipher','orbit','recall']){
    let r=await start(f,settings(id));assert.ok(!Object.hasOwn(r,'seed'));assert.ok(!Object.hasOwn(r.state,'seed'));
    r=(await f.call('/api/runs/'+r.id)).data;assert.ok(!Object.hasOwn(r,'seed'));assert.ok(!Object.hasOwn(r.state,'seed'));
    const listed=(await f.call('/api/runs')).data.find(x=>x.id===r.id);assert.ok(!Object.hasOwn(listed,'seed'));
    if(id==='cipher'){assert.ok(!Object.hasOwn(r.state,'secret'));for(let feature=0;feature<3;feature++)r=(await action(f,r,{type:'test',feature})).data;
     const candidate=r.state.candidates.find(c=>r.state.tests.every(t=>c.features[t.feature]===t.value));r=(await action(f,r,{type:'guess',id:candidate.id})).data;assert.equal(r.status,'completed');assert.equal(typeof r.seed,'string');
     const replay=await start(f,settings(id,{replaySeed:r.seed}));assert.equal(replay.practice,1);
    }
   }
  }finally{await f.close();}
 });
 test(`${kind}: Recall deadline is enforced on reads and direct actions without client hide`,async()=>{
  const f=await fixture(kind);try{
   let r=await start(f,settings('recall',{difficulty:'expert'}));assert.equal(r.state.readyAt,4500);assert.equal(r.state.answer.length,6);
   const answer=[...r.state.answer];f.sql.prepare('UPDATE runs SET active_since=? WHERE id=?').run(Date.now()-600000,r.id);
   r=(await f.call('/api/runs/'+r.id)).data;assert.equal(r.state.phase,'place');assert.ok(!Object.hasOwn(r.state,'answer'));
   const listed=(await f.call('/api/runs')).data.find(x=>x.id===r.id);assert.ok(!Object.hasOwn(listed.state,'answer'));
   r=(await action(f,r,{type:'place',symbol:0,cell:answer[0]})).data;assert.equal(r.state.phase,'place');assert.equal(r.state.placed[0],answer[0]);
   r=(await action(f,r,{type:'pause'})).data;r=(await action(f,r,{type:'resume'})).data;assert.ok(!Object.hasOwn(r.state,'answer'));
   r=(await action(f,r,{type:'replay'})).data;assert.equal(r.assisted,1);assert.equal(r.state.answer.length,6);
   r=await start(f,settings('recall',{mode:'practice',difficulty:'expert'}));f.sql.prepare('UPDATE runs SET active_since=? WHERE id=?').run(Date.now()-600000,r.id);
   r=(await f.call('/api/runs/'+r.id)).data;assert.equal(r.state.phase,'watch');assert.equal(r.state.answer.length,6);assert.equal(r.practice,1);
  }finally{await f.close();}
 });
}

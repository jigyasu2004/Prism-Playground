import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.mjs';

test('public guests can play, retain their session, and cannot read another visitor or private profile', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'prism-public-'));
  const app = createApp({dbPath: join(dir, 'db.sqlite'), origin: 'https://public.example', authConfig: {publicAccess: true}});
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = (path, session, body) => fetch(base + path, {method: body ? 'POST' : 'GET', headers: {...(session ? {cookie: session} : {}), ...(body ? {'content-type': 'application/json'} : {})}, body: body ? JSON.stringify(body) : undefined});
  try {
    const page = await call('/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="app"/);
    const cookieHeader = page.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly; Secure; SameSite=Lax/);
    const first = cookieHeader.split(';')[0];
    assert.equal((await call('/app.mjs', first)).status, 200);
    const started = await call('/api/runs', first, {game: 'relay', difficulty: 'normal', mode: 'puzzle'});
    assert.equal(started.status, 201);
    const run = await started.json();
    assert.equal((await call('/api/runs/' + run.id, first)).status, 200);
    const otherPage = await call('/');
    const second = otherPage.headers.get('set-cookie').split(';')[0];
    assert.notEqual(first, second);
    assert.equal((await call('/api/runs/' + run.id, second)).status, 400);
    assert.deepEqual(await (await call('/api/runs', second)).json(), []);
    const forged = await call('/api/runs/' + run.id, 'prism_session=local-owner');
    assert.equal(forged.status, 400);
    assert.ok(forged.headers.get('set-cookie'));
    const privateToken = 'p'.repeat(43);
    app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(privateToken, 'issuer|owner', Date.now() + 100000);
    const privateAttempt = await call('/api/runs/' + run.id, 'prism_session=' + privateToken);
    assert.equal(privateAttempt.status, 400);
    assert.ok(privateAttempt.headers.get('set-cookie'));
    assert.equal((await (await call('/health')).json()).private, false);
  } finally {
    await app.close();
    rmSync(dir, {recursive: true, force: true});
  }
});

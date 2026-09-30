import {randomBytes} from 'node:crypto';
import {cookie} from './auth.mjs';

// Public gameplay uses an unguessable guest session, never a shared owner profile.
export function publicAuthSystem(db) {
  const lifetime = 30 * 86400000;
  const sessionFor = req => {
    const id = cookie(req, 'prism_session');
    if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
    return db.prepare("SELECT user_id FROM sessions WHERE id=? AND expires>? AND user_id LIKE 'guest|%'").get(id, Date.now());
  };
  return {
    ready: true,
    identify(req) { return req.prismGuestUser || sessionFor(req)?.user_id || null; },
    async route(req, res, url) {
      if (url.pathname === '/auth/logout') {
        if (req.method !== 'POST') throw new Error('POST required');
        const session = sessionFor(req);
        if (session) db.prepare('DELETE FROM sessions WHERE id=?').run(cookie(req, 'prism_session'));
        res.writeHead(204, {'set-cookie': 'prism_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
        res.end();
        return true;
      }
      if (!sessionFor(req)) {
        const id = randomBytes(32).toString('base64url');
        req.prismGuestUser = 'guest|' + randomBytes(24).toString('base64url');
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(id, req.prismGuestUser, Date.now() + lifetime);
        res.setHeader('set-cookie', `prism_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${lifetime / 1000}`);
      }
      return false;
    },
  };
}

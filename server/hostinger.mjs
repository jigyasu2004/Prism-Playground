// Hostinger imports the entry module instead of invoking it as the main script.
import {createApp} from './index.mjs';

if (!process.env.DB_PATH || !process.env.APP_ORIGIN) {
  throw new Error('Production requires APP_ORIGIN and a durable DB_PATH');
}
const port = Number(process.env.PORT || 3000);
const app = createApp({
  dbPath: process.env.DB_PATH,
  origin: process.env.APP_ORIGIN,
  authConfig: {
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    allowed: process.env.OIDC_ALLOWED_SUBJECTS,
  },
});
app.server.listen(port, '0.0.0.0', () => {
  console.log(`Prism Playground production private server on port ${port}`);
});

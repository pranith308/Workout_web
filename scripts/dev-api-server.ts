/**
 * Local development API server.
 *
 * `npm run dev:full` uses `vercel dev` to serve the `/api/*` functions, which
 * requires an interactive Vercel login and real Firebase Admin credentials.
 * This script serves the exact same handlers with a tiny Node HTTP shim and
 * points the Firebase Admin SDK at the local Auth + Firestore emulators, so the
 * whole auth/plans flow runs locally with no external accounts or secrets.
 *
 * It only ever talks to the emulators; it is not a production server.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { connect } from 'node:net';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-workout-web';
const PORT = Number(process.env.DEV_API_PORT ?? 3000);
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

// Make the Admin SDK connect to the emulators instead of real Google APIs.
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;
process.env.INVITE_CODE = process.env.INVITE_CODE ?? 'demo-invite';

// The Admin SDK still needs a key to *sign* custom tokens locally. The Auth
// emulator does not verify the signature, so a throwaway RSA key is enough and
// keeps real credentials out of the repo.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: PROJECT_ID,
    client_email: `firebase-adminsdk@${PROJECT_ID}.iam.gserviceaccount.com`,
    private_key: privateKey,
  });
}

function waitForPort(hostPort: string, timeoutMs = 60_000): Promise<void> {
  const [host, portStr] = hostPort.split(':');
  const port = Number(portStr);
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = connect({ host, port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${hostPort}`));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

interface ResponseShim {
  status: (code: number) => ResponseShim;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
}

function enhanceResponse(res: ServerResponse): ResponseShim {
  const shim: ResponseShim = {
    status(code: number) {
      res.statusCode = code;
      return shim;
    },
    json(body: unknown) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    },
    send(body: unknown) {
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    },
  };
  return shim;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

async function main() {
  console.log(`[dev-api] waiting for Auth emulator at ${AUTH_EMULATOR_HOST}...`);
  await waitForPort(AUTH_EMULATOR_HOST);
  console.log(`[dev-api] waiting for Firestore emulator at ${FIRESTORE_EMULATOR_HOST}...`);
  await waitForPort(FIRESTORE_EMULATOR_HOST);

  // Import handlers AFTER env is configured so the Admin SDK initializes against
  // the emulators.
  const [signup, login, resetPin] = await Promise.all([
    import('../api/signup.ts').then((m) => m.default),
    import('../api/login.ts').then((m) => m.default),
    import('../api/reset-pin.ts').then((m) => m.default),
  ]);

  const routes: Record<string, (req: IncomingMessage, res: ResponseShim) => unknown> = {
    '/api/signup': signup as never,
    '/api/login': login as never,
    '/api/reset-pin': resetPin as never,
  };

  const server = createServer(async (req, res) => {
    const path = (req.url ?? '').split('?')[0];
    const handler = routes[path];
    if (!handler) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    try {
      // Vercel handlers expect an already-parsed JSON body and query object.
      (req as unknown as { body: unknown }).body = await readJsonBody(req);
      (req as unknown as { query: Record<string, string> }).query = {};
      await handler(req, enhanceResponse(res));
    } catch (err) {
      console.error(`[dev-api] handler error for ${path}`, err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`[dev-api] serving /api/* on http://localhost:${PORT}`);
    console.log(`[dev-api] project=${PROJECT_ID} invite code=${process.env.INVITE_CODE}`);
  });
}

main().catch((err) => {
  console.error('[dev-api] failed to start', err);
  process.exit(1);
});

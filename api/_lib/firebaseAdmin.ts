import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;
let envLoaded = false;

/** vercel dev often skips .env.local for /api — load it ourselves. */
function ensureLocalEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

  const candidates = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env.local'),
    join(process.cwd(), '..', '.env'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = val;
      }
    }
  }
}

function loadServiceAccount(): {
  project_id: string;
  client_email: string;
  private_key: string;
} {
  ensureLocalEnvLoaded();

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (path) {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    return JSON.parse(json) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
  }

  throw new Error(
    'Set FIREBASE_SERVICE_ACCOUNT_PATH (local) or FIREBASE_SERVICE_ACCOUNT_JSON (Vercel)',
  );
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serviceAccount = loadServiceAccount();

  app = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    }),
  });

  return app;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

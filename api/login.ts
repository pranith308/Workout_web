import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/firebaseAdmin.js';
import {
  checkLoginLockout,
  clearLoginFailures,
  createCustomToken,
  normalizeUsername,
  recordLoginFailure,
  validatePin,
  validateUsername,
  verifyPin,
} from './_lib/authHelpers.js';

type Body = { username?: string; pin?: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username = '', pin = '' } = req.body as Body;
    const trimmedUsername = username.trim();
    const usernameKey = normalizeUsername(trimmedUsername);

    const userError = validateUsername(trimmedUsername);
    if (userError) return res.status(400).json({ error: userError });

    const pinError = validatePin(pin);
    if (pinError) return res.status(400).json({ error: pinError });

    const lockout = await checkLoginLockout(usernameKey);
    if (lockout) return res.status(429).json({ error: lockout });

    const usernameSnap = await adminDb().collection('usernames').doc(usernameKey).get();
    if (!usernameSnap.exists) {
      return res.status(401).json({ error: 'Invalid username or PIN.' });
    }

    const uid = usernameSnap.data()?.uid as string;
    const userSnap = await adminDb().collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return res.status(401).json({ error: 'Invalid username or PIN.' });
    }

    const pinHash = (await adminDb().collection('userSecrets').doc(uid).get()).data()
      ?.pinHash as string;
    const valid = await verifyPin(pin, pinHash);
    if (!valid) {
      await recordLoginFailure(usernameKey);
      return res.status(401).json({ error: 'Invalid username or PIN.' });
    }

    await clearLoginFailures(usernameKey);
    const token = await createCustomToken(uid);
    return res.status(200).json({ token, username: userSnap.data()?.username ?? trimmedUsername });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

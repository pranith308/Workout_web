import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/firebaseAdmin.js';
import {
  checkLoginLockout,
  clearLoginFailures,
  createCustomToken,
  hashPin,
  normalizeUsername,
  recordLoginFailure,
  requireInviteCode,
  validatePin,
  validateUsername,
} from './_lib/authHelpers.js';

type Body = {
  username?: string;
  newPin?: string;
  inviteCode?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username = '', newPin = '', inviteCode = '' } = req.body as Body;
    const trimmedUsername = username.trim();
    const usernameKey = normalizeUsername(trimmedUsername);

    const inviteError = requireInviteCode(inviteCode);
    if (inviteError) return res.status(403).json({ error: inviteError });

    const userError = validateUsername(trimmedUsername);
    if (userError) return res.status(400).json({ error: userError });

    const pinError = validatePin(newPin);
    if (pinError) return res.status(400).json({ error: pinError });

    const lockout = await checkLoginLockout(`reset_${usernameKey}`);
    if (lockout) return res.status(429).json({ error: lockout });

    const usernameSnap = await adminDb().collection('usernames').doc(usernameKey).get();
    if (!usernameSnap.exists) {
      await recordLoginFailure(`reset_${usernameKey}`);
      return res.status(404).json({ error: 'Account not found.' });
    }

    const uid = usernameSnap.data()?.uid as string;
    const pinHash = await hashPin(newPin);
    await adminDb().collection('userSecrets').doc(uid).set({ pinHash }, { merge: true });
    await clearLoginFailures(`reset_${usernameKey}`);
    await clearLoginFailures(usernameKey);

    const token = await createCustomToken(uid);
    const userSnap = await adminDb().collection('users').doc(uid).get();
    return res.status(200).json({
      token,
      username: (userSnap.data()?.username as string | undefined) ?? trimmedUsername,
    });
  } catch (err) {
    console.error('reset-pin error', err);
    return res.status(500).json({ error: 'PIN reset failed. Please try again.' });
  }
}

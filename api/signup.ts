import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { adminAuth, adminDb } from './_lib/firebaseAdmin.js';
import {
  countUsers,
  createCustomToken,
  hashPin,
  maxUsersAllowed,
  normalizeUsername,
  requireInviteCode,
  validatePin,
  validateUsername,
} from './_lib/authHelpers.js';

type Body = { username?: string; pin?: string; inviteCode?: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username = '', pin = '', inviteCode = '' } = req.body as Body;
    const trimmedUsername = username.trim();
    const usernameKey = normalizeUsername(trimmedUsername);

    const inviteError = requireInviteCode(inviteCode);
    if (inviteError) return res.status(403).json({ error: inviteError });

    const userError = validateUsername(trimmedUsername);
    if (userError) return res.status(400).json({ error: userError });

    const pinError = validatePin(pin);
    if (pinError) return res.status(400).json({ error: pinError });

    const userCount = await countUsers();
    if (userCount >= maxUsersAllowed()) {
      return res.status(403).json({ error: 'New accounts are not available right now.' });
    }

    const usernameRef = adminDb().collection('usernames').doc(usernameKey);
    const existing = await usernameRef.get();
    if (existing.exists) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    const uid = `user_${randomUUID().slice(0, 8)}`;
    await adminAuth().createUser({ uid, displayName: trimmedUsername });

    const pinHash = await hashPin(pin);
    const batch = adminDb().batch();
    batch.set(adminDb().collection('users').doc(uid), {
      username: trimmedUsername,
      usernameKey,
      createdAt: new Date().toISOString(),
    });
    batch.set(adminDb().collection('userSecrets').doc(uid), { pinHash });
    batch.set(usernameRef, { uid });
    await batch.commit();

    const token = await createCustomToken(uid);
    return res.status(201).json({ token, username: trimmedUsername });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
}

import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { adminAuth, adminDb } from './firebaseAdmin.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PIN_RE = /^\d{4}$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DEFAULT_MAX_USERS = 10;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username.trim())) {
    return 'Username must be 3–20 characters (letters, numbers, underscore).';
  }
  return null;
}

export function validatePin(pin: string): string | null {
  if (!PIN_RE.test(pin)) {
    return 'PIN must be exactly 4 digits.';
  }
  return null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function createCustomToken(uid: string): Promise<string> {
  return adminAuth().createCustomToken(uid);
}

/** Shared invite code for signup + forgot-PIN (set INVITE_CODE on Vercel). */
export function requireInviteCode(inviteCode: string): string | null {
  const expected = process.env.INVITE_CODE?.trim();
  if (!expected) {
    return 'Server invite code is not configured.';
  }
  const provided = inviteCode.trim();
  if (!provided) {
    return 'Invite code is required.';
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return 'Invalid invite code.';
  }
  return null;
}

export function maxUsersAllowed(): number {
  const raw = process.env.MAX_USERS?.trim();
  const n = raw ? Number(raw) : DEFAULT_MAX_USERS;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_USERS;
}

export async function countUsers(): Promise<number> {
  const snap = await adminDb().collection('usernames').count().get();
  return snap.data().count;
}

export async function checkLoginLockout(usernameKey: string): Promise<string | null> {
  const ref = adminDb().collection('loginAttempts').doc(usernameKey);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() as { failures?: number; lockedUntil?: number };
  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    const mins = Math.ceil((data.lockedUntil - Date.now()) / 60000);
    return `Too many attempts. Try again in ${mins} minute(s).`;
  }
  return null;
}

export async function recordLoginFailure(usernameKey: string): Promise<void> {
  const ref = adminDb().collection('loginAttempts').doc(usernameKey);
  const snap = await ref.get();
  const failures = ((snap.data()?.failures as number | undefined) ?? 0) + 1;
  const update: { failures: number; lockedUntil?: number } = { failures };
  if (failures >= MAX_LOGIN_ATTEMPTS) {
    update.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  await ref.set(update, { merge: true });
}

export async function clearLoginFailures(usernameKey: string): Promise<void> {
  await adminDb().collection('loginAttempts').doc(usernameKey).delete();
}

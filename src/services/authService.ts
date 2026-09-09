import { signInWithCustomToken, signOut, type User } from 'firebase/auth';
import { getAuthInstance } from './firebase';

interface AuthResponse {
  token: string;
  username: string;
}

async function postAuth(path: '/api/signup' | '/api/login', username: string, pin: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });

  const data = (await res.json()) as AuthResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Authentication failed');
  }
  return data;
}

export async function signup(username: string, pin: string): Promise<User> {
  const { token } = await postAuth('/api/signup', username, pin);
  const cred = await signInWithCustomToken(getAuthInstance(), token);
  return cred.user;
}

export async function login(username: string, pin: string): Promise<User> {
  const { token } = await postAuth('/api/login', username, pin);
  const cred = await signInWithCustomToken(getAuthInstance(), token);
  return cred.user;
}

export async function logout(): Promise<void> {
  await signOut(getAuthInstance());
}

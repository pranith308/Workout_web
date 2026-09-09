import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthInstance, getDb, isFirebaseConfigured } from '../services/firebase';
import { logout as authLogout } from '../services/authService';

interface AuthContextValue {
  user: User | null;
  username: string | null;
  loading: boolean;
  firebaseReady: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(getAuthInstance(), async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const snap = await getDoc(doc(getDb(), 'users', nextUser.uid));
        setUsername((snap.data()?.username as string | undefined) ?? null);
      } else {
        setUsername(null);
      }
      setLoading(false);
    });

    return unsub;
  }, [firebaseReady]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      username,
      loading,
      firebaseReady,
      logout: authLogout,
    }),
    [user, username, loading, firebaseReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

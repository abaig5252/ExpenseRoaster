import * as React from 'react';
import { getToken, setToken, clearToken, apiGet, apiGetWithToken, apiPatch } from './api';

export interface MeUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tier: 'free' | 'premium';
  currency: string;
  onboardingComplete: boolean;
  monthlyUploadCount: number;
  hasAnnualReport: boolean;
  emailVerified: boolean;
}

interface AuthContextType {
  user: MeUser | null;
  isLoading: boolean;
  signIn: (jwt: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
  updateCurrency: (code: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
  refreshUser: async () => {},
  updateCurrency: async () => {},
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<MeUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const stored = await withTimeout(getToken(), 3_000);
      if (stored) {
        // Show the app immediately with the stored token, verify in background
        setIsLoading(false);
        try {
          const me = await withTimeout(apiGet<MeUser>('/api/me'), 8_000);
          setUser(me);
        } catch {
          // Server unreachable or token invalid — sign out
          clearToken().catch(() => {});
          setUser(null);
        }
      } else {
        setIsLoading(false);
      }
    } catch {
      clearToken().catch(() => {});
      setIsLoading(false);
    }
  }

  async function signIn(jwt: string) {
    await setToken(jwt);
    const me = await apiGetWithToken<MeUser>('/api/me', jwt);
    setUser(me);
  }

  function signOut() {
    clearToken();
    setUser(null);
  }

  async function refreshUser() {
    const me = await apiGet<MeUser>('/api/me');
    setUser(me);
  }

  async function updateCurrency(code: string) {
    // Optimistic update — UI changes immediately
    setUser(prev => prev ? { ...prev, currency: code } : prev);
    // Persist to server (fire and forget — don't block UI)
    apiPatch('/api/me/profile', { currency: code }).catch(() => {
      // Revert on failure
      refreshUser().catch(() => {});
    });
  }

  return React.createElement(
    AuthContext.Provider,
    { value: { user, isLoading, signIn, signOut, refreshUser, updateCurrency } },
    children,
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}

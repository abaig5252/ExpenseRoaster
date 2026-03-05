import * as React from 'react';
import { getToken, setToken, clearToken, apiGet, apiGetWithToken } from './api';

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
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
  refreshUser: async () => {},
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
    // Hard safety valve — isLoading will always clear within 15 seconds no matter what
    const safetyTimer = setTimeout(() => setIsLoading(false), 15_000);
    bootstrap().finally(() => clearTimeout(safetyTimer));
  }, []);

  async function bootstrap() {
    try {
      const stored = await withTimeout(getToken(), 5_000);
      if (stored) {
        const me = await withTimeout(apiGet<MeUser>('/api/me'), 10_000);
        setUser(me);
      }
    } catch {
      // Token invalid, expired, or network unavailable — clear and go to login
      clearToken().catch(() => {}); // fire-and-forget, don't await
    } finally {
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

  return React.createElement(
    AuthContext.Provider,
    { value: { user, isLoading, signIn, signOut, refreshUser } },
    children,
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}

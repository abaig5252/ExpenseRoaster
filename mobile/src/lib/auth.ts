import * as React from 'react';
import { getToken, setToken, clearToken, apiGet } from './api';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<MeUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const stored = await getToken();
      if (stored) {
        const me = await apiGet<MeUser>('/api/me');
        setUser(me);
      }
    } catch {
      await clearToken();
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(jwt: string) {
    await setToken(jwt);
    const me = await apiGet<MeUser>('/api/me');
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

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}

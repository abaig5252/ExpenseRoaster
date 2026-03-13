import * as React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
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

const SUPPORTED_CURRENCIES = new Set([
  'USD','GBP','EUR','CAD','AUD','JPY','CHF','INR','SGD','NZD','HKD','MXN','BRL','SEK','NOK','DKK',
]);

const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  AU: 'AUD',
  CA: 'CAD',
  NZ: 'NZD',
  HK: 'HKD',
  SG: 'SGD',
  JP: 'JPY',
  CH: 'CHF',
  LI: 'CHF',
  MX: 'MXN',
  BR: 'BRL',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  IN: 'INR',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', PT: 'EUR', AT: 'EUR', FI: 'EUR', IE: 'EUR',
  GR: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR',
  LT: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR',
};

function detectDeviceCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = locale.split(/[-_]/);
    const region = parts.length >= 2 ? parts[parts.length - 1].toUpperCase() : '';
    const detected = REGION_TO_CURRENCY[region] ?? 'USD';
    return SUPPORTED_CURRENCIES.has(detected) ? detected : 'USD';
  } catch {
    return 'USD';
  }
}

const CURRENCY_FLAG_KEY = '@expense_roaster_currency_synced';

async function isCurrencySynced(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(CURRENCY_FLAG_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

async function markCurrencySynced(): Promise<void> {
  try {
    await SecureStore.setItemAsync(CURRENCY_FLAG_KEY, '1');
  } catch {}
}

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
  const appState = React.useRef<AppStateStatus>(AppState.currentState);

  React.useEffect(() => {
    bootstrap();
  }, []);

  // Refresh user whenever the app comes back to foreground (e.g. after Stripe checkout)
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        getToken().then(token => {
          if (token) {
            apiGet<MeUser>('/api/me').then(me => setUser(me)).catch(() => {});
          }
        }).catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  async function syncCurrencyOnce(me: MeUser): Promise<MeUser> {
    const alreadySynced = await isCurrencySynced();
    if (alreadySynced) return me;

    const detected = detectDeviceCurrency();
    await markCurrencySynced();

    if (detected !== me.currency) {
      try {
        await apiPatch('/api/me/profile', { currency: detected });
        return { ...me, currency: detected };
      } catch {
        return me;
      }
    }
    return me;
  }

  async function bootstrap() {
    try {
      const stored = await withTimeout(getToken(), 3_000);
      if (stored) {
        setIsLoading(false);
        try {
          const me = await withTimeout(apiGet<MeUser>('/api/me'), 8_000);
          const synced = await syncCurrencyOnce(me);
          setUser(synced);
        } catch {
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
    const synced = await syncCurrencyOnce(me);
    setUser(synced);
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
    setUser(prev => prev ? { ...prev, currency: code } : prev);
    apiPatch('/api/me/profile', { currency: code }).catch(() => {
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

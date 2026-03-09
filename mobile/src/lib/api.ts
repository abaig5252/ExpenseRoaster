import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'https://your-app.replit.app'
).replace(/^http:\/\//, 'https://');

const TOKEN_KEY = 'mobile_auth_token';
const FETCH_TIMEOUT_MS = 30_000;

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

async function buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['x-app-token'] = token;
  return headers;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers = await buildHeaders(options?.headers as Record<string, string>);
  return fetchWithTimeout(`${API_BASE_URL}${path}`, { ...options, headers });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiGetWithToken<T>(path: string, token: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-app-token': token },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

function assertJson(res: Response): void {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`Server returned non-JSON response (status ${res.status}). Check API_BASE_URL uses https://.`);
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Error ${res.status}` }));
    throw new Error((err as { message?: string }).message || `API error ${res.status}`);
  }
  assertJson(res);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Error ${res.status}` }));
    throw new Error((err as { message?: string }).message || `API error ${res.status}`);
  }
  assertJson(res);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiUploadFile(path: string, formData: FormData): Promise<unknown> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['x-app-token'] = token;
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Error ${res.status}` }));
    throw new Error((err as { message?: string }).message || `API error ${res.status}`);
  }
  return res.json();
}

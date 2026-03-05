import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://your-app.replit.app';

const TOKEN_KEY = 'mobile_auth_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers = await buildHeaders(options?.headers as Record<string, string>);
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

// Like apiGet but uses an explicit token — avoids SecureStore timing issues on first login
export async function apiGetWithToken<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Error ${res.status}` }));
    throw new Error((err as { message?: string }).message || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

export async function apiUploadFile(path: string, formData: FormData): Promise<unknown> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Error ${res.status}` }));
    throw new Error((err as { message?: string }).message || `API error ${res.status}`);
  }
  return res.json();
}

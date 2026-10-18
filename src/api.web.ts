const API_BASE = 'http://localhost:8080/api/v1';
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/uploads/')
    ? path.replace(/^\/uploads\//, '/api/v1/uploads/')
    : path.startsWith('/')
      ? path
      : `/${path}`;
  return `${API_ORIGIN}${normalizedPath}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('fixhome_token');
  const headers = new Headers(options.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const data = payload as { message?: string; error?: string } | null;
    throw new Error(data?.message || data?.error || 'Request failed');
  }

  return payload as T;
}

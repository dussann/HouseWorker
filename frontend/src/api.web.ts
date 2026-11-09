const API_BASE = import.meta.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
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
  const controller = new AbortController();
  const abortForCaller = () => controller.abort();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener('abort', abortForCaller, { once: true });
  }

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
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
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new Error('Server ne odgovara. Proverite internet vezu i EXPO_PUBLIC_API_URL.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortForCaller);
  }
}

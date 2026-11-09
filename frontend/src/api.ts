import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const isExpoLanHost = expoHost !== undefined && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(expoHost);
const defaultApiHost = isExpoLanHost
  ? expoHost
  : Platform.OS === 'android'
    ? '10.0.2.2'
    : 'localhost';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || `http://${defaultApiHost}:8080/api/v1`;
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');
const TOKEN_KEY = 'fixhome_token';
const USER_KEY = 'fixhome_user';

export type SessionUser = {
  email: string;
  displayName?: string;
  profileImageUrl?: string | null;
  role: string;
  city?: string;
};
export type Session = { token: string; user: SessionUser };
export type RegistrationPayload = {
  displayName: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  city: string;
  categoryIds: number[];
};
export type AuthResponse = {
  accessToken?: string;
  token?: string;
  email: string;
  displayName?: string;
  profileImageUrl?: string | null;
  role?: string;
  city?: string;
};

export async function getSession(): Promise<Session | null> {
  const [token, userJson] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);

  if (!token || !userJson) return null;

  try {
    return { token, user: JSON.parse(userJson) as SessionUser };
  } catch {
    await clearSession();
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/uploads/')
    ? path.replace(/^\/uploads\//, '/api/v1/uploads/')
    : path.startsWith('/')
      ? path
      : `/${path}`;
  return `${API_ORIGIN}${normalizedPath}`;
}

export async function uploadImage(
  uri: string,
  mimeType: string,
): Promise<{ imageUrl: string }> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error('Prijavite se pre slanja slike.');

  const response = await FileSystem.uploadAsync(`${API_BASE}/uploads`, uri, {
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'image',
    mimeType,
    httpMethod: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  let payload: unknown = null;
  if (response.body) {
    try {
      payload = JSON.parse(response.body);
    } catch {
      payload = { message: response.body };
    }
  }

  if (response.status < 200 || response.status >= 300) {
    const data = payload as { message?: string; error?: string } | null;
    throw new Error(data?.message || data?.error || 'Upload slike nije uspeo');
  }

  return payload as { imageUrl: string };
}

export async function registerWithImage(
  uri: string,
  mimeType: string,
  registration: RegistrationPayload,
): Promise<AuthResponse> {
  const response = await FileSystem.uploadAsync(`${API_BASE}/auth/register-with-image`, uri, {
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'image',
    mimeType,
    httpMethod: 'POST',
    parameters: {
      displayName: registration.displayName,
      email: registration.email,
      password: registration.password,
      phone: registration.phone,
      role: registration.role,
      city: registration.city,
      categoryIds: registration.categoryIds.join(','),
    },
  });

  let payload: unknown = null;
  if (response.body) {
    try {
      payload = JSON.parse(response.body);
    } catch {
      payload = { message: response.body };
    }
  }

  if (response.status < 200 || response.status >= 300) {
    const data = payload as { message?: string; error?: string } | null;
    throw new Error(data?.message || data?.error || 'Registracija nije uspela');
  }

  return payload as AuthResponse;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
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
      throw new Error('Server ne odgovara. Proverite vezu telefona sa računarom i EXPO_PUBLIC_API_URL.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortForCaller);
  }
}

import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * The API address to call. When the app is opened from another computer on the
 * network (e.g. http://10.100.1.4:3000), "localhost" in NEXT_PUBLIC_API_URL
 * would point at that other computer, so the host part is swapped for the
 * address the page itself was opened from. Port and path stay as configured.
 */
export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  try {
    const url = new URL(API_BASE_URL);
    const local = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    if (local(url.hostname) && !local(window.location.hostname)) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // fall through to the configured value
  }
  return API_BASE_URL;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.baseURL = resolveApiBaseUrl();
    const token = localStorage.getItem('smart_hrm_token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      localStorage.removeItem('smart_hrm_token');
      localStorage.removeItem('smart_hrm_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(err: any): string {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

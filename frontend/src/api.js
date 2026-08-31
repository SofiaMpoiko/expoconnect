import axios from 'axios';
import { clearAdminToken, getAdminToken } from './adminAuth.js';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let redirectingToLogin = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && getAdminToken()) {
      const url = String(err?.config?.url || '');
      if (url.includes('/admin/login')) return Promise.reject(err);

      clearAdminToken();
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      if (path === '/admin' && !redirectingToLogin) {
        redirectingToLogin = true;
        window.location.assign('/');
      }
    }
    return Promise.reject(err);
  }
);

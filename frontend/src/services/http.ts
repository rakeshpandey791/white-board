import axios from 'axios';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const http = axios.create({
  baseURL: configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : '/api'
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

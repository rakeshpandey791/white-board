import { http } from './http';

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export const authService = {
  signup: (payload: { email: string; password: string; name: string }) =>
    http.post<AuthResponse>('/auth/signup', payload).then((res) => res.data),
  login: (payload: { email: string; password: string }) =>
    http.post<AuthResponse>('/auth/login', payload).then((res) => res.data)
};

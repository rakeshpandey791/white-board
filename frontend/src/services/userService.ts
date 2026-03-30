import { http } from './http';
import { AuthResponse } from './authService';

export const userService = {
  getMe: () => http.get<AuthResponse['user']>('/users/me').then((res) => res.data),
  updateProfile: (payload: { name: string; email: string; currentPassword?: string; newPassword?: string }) =>
    http.put<AuthResponse>('/users/me', payload).then((res) => res.data)
};

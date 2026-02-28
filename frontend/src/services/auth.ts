import api from './api';
import { AuthTokens, User } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const { data } = await api.post<AuthTokens>('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async register(data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }): Promise<User> {
    const res = await api.post<User>('/auth/register', data);
    return res.data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/usuarios/me');
    return data;
  },
};

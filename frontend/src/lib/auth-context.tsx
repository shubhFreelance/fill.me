'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import axios from 'axios';
import { User, AuthUser } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Configure axios defaults
  useEffect(() => {
    const savedToken = Cookies.get('auth_token');
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      fetchUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        email,
        password,
      });
      
      const { user: userData, token: authToken }: AuthUser = response.data;
      
      setUser(userData);
      setToken(authToken);
      
      // Set cookie and axios header
      Cookies.set('auth_token', authToken, { expires: 7 });
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const signup = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        email,
        password,
        firstName,
        lastName,
      });
      
      const { user: userData, token: authToken }: AuthUser = response.data;
      
      setUser(userData);
      setToken(authToken);
      
      // Set cookie and axios header
      Cookies.set('auth_token', authToken, { expires: 7 });
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Signup failed');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    Cookies.remove('auth_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
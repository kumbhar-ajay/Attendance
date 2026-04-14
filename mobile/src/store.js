// FILE: mobile/src/store.js
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  loadSession: async () => {
    try {
      const [token, refreshToken, userStr] = await AsyncStorage.multiGet(['token', 'refreshToken', 'user']);
      if (token[1] && userStr[1]) {
        set({ token: token[1], user: JSON.parse(userStr[1]), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setSession: async (token, refreshToken, user) => {
    await AsyncStorage.multiSet([['token', token], ['refreshToken', refreshToken], ['user', JSON.stringify(user)]]);
    set({ token, user });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
    set({ user: null, token: null });
  },

  updateUser: async (updates) => {
    const user = { ...get().user, ...updates };
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
}));
// FILE: mobile/src/store.js
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  testMode: false,
  testDate: null,

  setTestMode: (val) => {
    const today = get().testDate || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();
    set({ testMode: val, testDate: val ? today : null });
  },

  changeTestDate: (dir) => {
    const current = get().testDate || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();
    const d = new Date(current + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    const newDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    set({ testDate: newDate });
  },

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

  viewingManager: null,
  setViewingManager: (manager) => set({ viewingManager: manager }),
  clearViewingManager: () => set({ viewingManager: null }),
}));
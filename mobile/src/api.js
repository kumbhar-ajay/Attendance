// FILE: mobile/src/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        await AsyncStorage.setItem('token', data.token);
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch {
        await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (mobile, password) => api.post('/api/auth/login', { mobile, password });
export const changePassword = (currentPassword, newPassword) => api.put('/api/auth/change-password', { currentPassword, newPassword });
export const adminChangePassword = (userId, password) => api.put(`/api/admin/users/${userId}/password`, { password });
export const adminChangeRate = (userId, rate, applyFrom) => api.put(`/api/admin/users/${userId}/rate`, { rate, applyFrom });

// Upload
export const uploadPhoto = (image) => api.post('/api/upload/photo', { image });

// Admin
export const getManagers = () => api.get('/api/admin/managers');
export const createManager = (data) => api.post('/api/admin/managers', data);
export const deleteManager = (id) => api.delete(`/api/admin/managers/${id}`);

// Workers
export const getWorkers = () => api.get('/api/workers');
export const getInactiveWorkers = () => api.get('/api/workers/inactive');
export const getHiddenWorkers = () => api.get('/api/workers/hidden');
export const getDisabledWorkers = () => api.get('/api/workers/disabled');
export const createWorker = (data) => api.post('/api/workers', data);
export const updateWorkerStatus = (id, status, reason) => api.put(`/api/workers/${id}/status`, { status, reason });
export const toggleHideWorker = (id) => api.put(`/api/workers/${id}/toggle-hidden`);
export const getWorkerHistory = (id, month) => api.get(`/api/workers/${id}/history`, { params: { month } });

// Attendance
export const getTodayAttendance = (date, managerId) => api.get('/api/attendance/today', { params: { ...(date ? { date } : {}), ...(managerId ? { managerId } : {}) } });
export const markAttendance = (workerId, date, value) => api.post('/api/attendance', { workerId, date, value });
export const editAttendance = (attId, value) => api.put(`/api/attendance/${attId}`, { value });
export const updateTravel = (date, amount) => api.put('/api/attendance/travel', { date, amount });
export const editWorkerTravel = (workerId, date, amount) => api.put(`/api/attendance/travel/${workerId}`, { date, amount });
export const getMyAttendance = (month) => api.get('/api/attendance/me', { params: { month } });
export const getStreak = (workerId) => api.get(`/api/attendance/streak/${workerId}`);
export const fillAbsent = (date) => api.post('/api/attendance/fill-absent', { date });

// Advance
export const addAdvance = (workerId, amount, date, note) => api.post('/api/advance', { workerId, amount, date, note });
export const editAdvance = (id, amount) => api.put(`/api/advance/${id}`, { amount });
export const deleteAdvance = (id) => api.delete(`/api/advance/${id}`);

// Actions
export const getActionLog = () => api.get('/api/actions/log');
export const undoAction = (actionId) => api.post('/api/actions/undo', { actionId });

// Report
export const getReport = (month) => api.get('/api/report', { params: { month } });
export const getBalancePayment = (month) => api.get('/api/report/balance', { params: { month } });
export const getBalanceExcelUrl = (month, columns, token) => `${API_URL}/api/report/balance-excel?month=${month}&columns=${columns}&token=${token}`;
export const getBalancePdfUrl = (month, columns, token) => `${API_URL}/api/report/balance-pdf?month=${month}&columns=${columns}&token=${token}`;
export const getReportExcelUrl = (month, token) => `${API_URL}/api/report/excel?month=${month}&token=${token}`;

export default api;
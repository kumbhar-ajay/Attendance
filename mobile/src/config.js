// FILE: mobile/src/config.js
// ⚠️ IMPORTANT: Change this to your computer's local IP when testing on a physical device
// For Android Emulator: http://10.0.2.2:5000
// For Physical Device: http://192.168.X.X:5000 (find your IP with `ipconfig` on Windows / `ifconfig` on Mac)
export const API_URL = 'http://172.20.10.3:5000';

export const ATT_MAP = {
  '0':    { label: 'A',   display: 'A',    color: '#E24B4A', isAbsent: true },
  '0.5':  { label: '½',   display: '½',    color: '#EF9F27' },
  '1':    { label: 'P',   display: 'P',    color: '#1D9E75' },
  '1.25': { label: 'P¼',  display: 'P¼',   color: '#1D9E75' },
  '1.5':  { label: 'P½',  display: 'P½',   color: '#1D9E75' },
  '2':    { label: 'PP',  display: 'PP',   color: '#1D9E75' },
  '2.25': { label: 'PP¼', display: 'PP¼',  color: '#1D9E75' },
  '2.5':  { label: 'PP½', display: 'PP½',  color: '#1D9E75' },
  '3':    { label: 'PPP', display: 'PPP',  color: '#1D9E75' },
};

export const QUICK_ATT = [
  { value: '0',   label: 'A' },
  { value: '0.5', label: '½' },
  { value: '1',   label: 'P' },
  { value: '1.5', label: 'P½' },
  { value: '2',   label: 'PP' },
];

export const MORE_ATT = [
  { value: '2.5', label: 'PP½' },
  { value: '3',   label: 'PPP' },
  { value: '1.25',label: 'P¼' },
];

export const QUICK_ADV = [500, 1000, 1500, 2000];

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  labour: 'Helper',
  mistry: 'Mistry',
  half_mistry: 'Half Mistry',
};

export const COLORS = {
  primary: '#185FA5',
  green: '#1D9E75',
  red: '#E24B4A',
  amber: '#EF9F27',
  bg: '#F5F5F5',
  card: '#FFFFFF',
  border: '#E0E0E0',
  textPrimary: '#1A1A1A',
  textSecondary: '#757575',
  faded: '#F0F0F0',
};
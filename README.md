# Attendance
SETUP INSTRUCTIONS
1. Backend
bashcd backend
npm install
# Create .env with your credentials (already have it)
npm run dev
2. Find Your Local IP (for physical device)
bash# Windows:
ipconfig
# Mac/Linux:
ifconfig
# Look for IPv4 — e.g. 192.168.1.105
3. Mobile — update IP
Open mobile/src/config.js and change:
javascriptexport const API_URL = 'http://192.168.1.105:5000'; // Your actual IP
4. Mobile setup
bashcd mobile
npm install
npx expo start --android
5. First Login
Mobile: 9012345678
Password: admin123
6. Create a manager from Admin screen, then log in as manager and start adding workers.

Key things to know:

The .env file you shared goes in the backend/ folder as-is
Both device and laptop must be on the same WiFi for the app to connect
If expo gives reanimated warnings, run npx expo install react-native-reanimated again
For production APK, use eas build --platform android
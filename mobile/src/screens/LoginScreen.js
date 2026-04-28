// FILE: mobile/src/screens/LoginScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { login } from '../api';
import { useStore } from '../store';
import { COLORS } from '../config';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { setSession } = useStore();

  const handleLogin = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) { Toast.show({ type: 'error', text1: 'No Internet', text2: 'Please connect to the internet first' }); return; }
    if (!mobile || mobile.length !== 10) { Toast.show({ type: 'error', text1: 'Invalid Mobile', text2: 'Enter 10-digit mobile number' }); return; }
    if (!password) { Toast.show({ type: 'error', text1: 'Password required' }); return; }
    setLoading(true);
    try {
      const { data } = await login(mobile.trim(), password);
      await setSession(data.token, data.refreshToken, data.user);
      const role = data.user.role;
      if (role === 'admin') navigation.replace('AdminApp');
      else if (role === 'manager') navigation.replace('ManagerApp');
      else navigation.replace('WorkerApp');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Login Failed', text2: e.response?.data?.message || 'Check credentials and try again' });
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.appName}>Attendance Pro</Text>
          <Text style={styles.appSub}>Civil Work Manager</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <TextInput
            style={styles.input} placeholder="10-digit mobile number" placeholderTextColor="#aaa"
            keyboardType="numeric" maxLength={10} value={mobile} onChangeText={setMobile}
          />
          <Text style={styles.label}>Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Enter password" placeholderTextColor="#aaa"
              secureTextEntry={!showPass} value={password} onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Text style={{ color: COLORS.primary, fontSize: 14 }}>{showPass ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>Forgot password? Contact your admin</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  header: { flex: 0.4, justifyContent: 'center', alignItems: 'center' },
  logoBox: { width: 72, height: 72, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary },
  appName: { color: '#fff', fontSize: 22, fontWeight: '600' },
  appSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  form: { flex: 0.6, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingTop: 32 },
  label: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 14, fontSize: 16, color: COLORS.textPrimary, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 14 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  hint: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 13, marginTop: 20 },
});
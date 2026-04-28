// FILE: mobile/src/screens/CreateWorker.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { createWorker, uploadPhoto } from '../api';
import { useStore } from '../store';
import { COLORS } from '../config';

const ROLES = [
  { label: 'Mistry', value: 'mistry' },
  { label: 'Labour', value: 'labour' },
  { label: 'Half Mistry', value: 'half_mistry' },
];

export default function CreateWorker({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { viewingManager, user } = useStore();
  // Admin creating a worker: always use viewingManager from store (more reliable than route params in drawer)
  const forManagerId = (user?.role === 'admin' && viewingManager) ? viewingManager._id : (route?.params?.forManagerId || null);
  const managerName = (user?.role === 'admin' && viewingManager) ? viewingManager.name : (route?.params?.managerName || null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('');
  const [rate, setRate] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission Denied', 'Please allow access in settings'); return; }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto(asset.uri);
      setUploading(true);
      try {
        const base64Img = `data:image/jpeg;base64,${asset.base64}`;
        const res = await uploadPhoto(base64Img);
        setPhotoUrl(res.data.url);
        Toast.show({ type: 'success', text1: 'Photo uploaded!' });
      } catch {
        Toast.show({ type: 'error', text1: 'Photo upload failed' });
        setPhoto(null);
      } finally { setUploading(false); }
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { Toast.show({ type: 'error', text1: 'Name required' }); return; }
    if (!mobile || mobile.length !== 10) { Toast.show({ type: 'error', text1: '10-digit mobile required' }); return; }
    if (!role) { Toast.show({ type: 'error', text1: 'Select a role' }); return; }
    if (!rate || Number(rate) <= 0) { Toast.show({ type: 'error', text1: 'Enter valid rate' }); return; }
    setCreating(true);
    try {
      await createWorker({ name: name.trim(), mobile: mobile.trim(), role, rate: Number(rate), photoUrl, ...(forManagerId ? { forManagerId } : {}) });
      Toast.show({ type: 'success', text1: `${name} created!`, text2: `Default password: ${mobile}` });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed to create worker' });
    } finally { setCreating(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{managerName ? `Add Worker for ${managerName}` : 'Add New Worker'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* Photo */}
        <View style={styles.photoSection}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>No Photo</Text>
            </View>
          )}
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(true)} disabled={uploading}>
              <Text style={styles.photoBtnText}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(false)} disabled={uploading}>
              <Text style={styles.photoBtnText}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>
          {uploading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 8 }} />}
          <Text style={styles.photoHint}>Photo is optional</Text>
        </View>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} placeholder="Worker's full name" value={name} onChangeText={setName} />

        <Text style={styles.label}>Mobile Number *</Text>
        <TextInput style={styles.input} placeholder="10-digit mobile" keyboardType="numeric" maxLength={10} value={mobile} onChangeText={setMobile} />

        <Text style={styles.label}>Role *</Text>
        <View style={styles.roleRow}>
          {ROLES.map(r => (
            <TouchableOpacity key={r.value} style={[styles.roleBtn, role === r.value && styles.roleBtnActive]} onPress={() => setRole(r.value)}>
              <Text style={[styles.roleBtnText, role === r.value && styles.roleBtnTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Daily Rate (₹) *</Text>
        <TextInput style={styles.input} placeholder="e.g. 600 or 1300" keyboardType="numeric" value={rate} onChangeText={setRate} />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>🔐 Default password will be mobile number: {mobile || 'XXXXXXXXXX'}</Text>
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating || uploading}>
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Worker</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingBottom: 14, paddingHorizontal: 16 },
  backBtn: { marginRight: 12 },
  backBtnText: { color: '#fff', fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  photoSection: { alignItems: 'center', marginBottom: 24, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  photoPreview: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  photoPlaceholderText: { color: COLORS.textSecondary, fontSize: 12 },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  photoBtnText: { fontSize: 14, color: COLORS.textPrimary },
  photoHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 7, marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', backgroundColor: '#fff' },
  roleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleBtnText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  roleBtnTextActive: { color: '#fff', fontWeight: '700' },
  infoBox: { backgroundColor: '#EBF4FF', borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#B3D4F5' },
  infoText: { fontSize: 14, color: COLORS.primary },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 30 },
  createBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
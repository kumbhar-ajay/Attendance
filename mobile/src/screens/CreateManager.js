// FILE: mobile/src/screens/CreateManager.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { createManager } from '../api';
import { COLORS } from '../config';

export default function CreateManager({ navigation }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [rate, setRate] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { Toast.show({ type: 'error', text1: 'Name required' }); return; }
    if (!mobile || mobile.length !== 10) { Toast.show({ type: 'error', text1: '10-digit mobile required' }); return; }
    if (!rate || Number(rate) <= 0) { Toast.show({ type: 'error', text1: 'Enter valid daily rate' }); return; }
    setCreating(true);
    try {
      await createManager({ name: name.trim(), mobile: mobile.trim(), rate: Number(rate) });
      Toast.show({ type: 'success', text1: `Manager ${name} created!`, text2: `Default password: ${mobile}` });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed to create manager' });
    } finally { setCreating(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Manager</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Manager name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          style={styles.input}
          placeholder="10-digit mobile"
          keyboardType="numeric"
          maxLength={10}
          value={mobile}
          onChangeText={setMobile}
        />

        <Text style={styles.label}>Daily Rate (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="Rate per day"
          keyboardType="numeric"
          value={rate}
          onChangeText={setRate}
        />

        <Text style={styles.hint}>Default login password will be the mobile number.</Text>

        <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
          {creating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Create Manager</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',

    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { color: '#fff', fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

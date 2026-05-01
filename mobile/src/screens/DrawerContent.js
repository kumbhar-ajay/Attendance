// FILE: mobile/src/screens/DrawerContent.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInactiveWorkers, updateWorkerStatus } from '../api';
import { useStore } from '../store';
import { COLORS, ROLE_LABELS } from '../config';
import Toast from 'react-native-toast-message';

export default function DrawerContent({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, viewingManager } = useStore();
  const [inactiveWorkers, setInactiveWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchInactive(); }, []);

  const fetchInactive = async () => {
    try {
      const res = await getInactiveWorkers();
      setInactiveWorkers(res.data.data);
    } catch { } finally { setLoading(false); }
  };

  const disabled = inactiveWorkers.filter(w => w.status === 'disabled');

  const reactivate = (worker) => {
    Alert.alert('Reactivate', `Bring ${worker.name} back to home screen?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reactivate', onPress: async () => {
        try {
          await updateWorkerStatus(worker._id, 'active');
          Toast.show({ type: 'success', text1: `${worker.name} is active again` });
          fetchInactive();
        } catch { Toast.show({ type: 'error', text1: 'Failed' }); }
      }}
    ]);
  };

  const navItem = (label, icon, screen, params) => (
    <TouchableOpacity style={styles.navItem} onPress={() => { navigation.closeDrawer(); navigation.navigate(screen, params); }}>
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={styles.navLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>{ROLE_LABELS[user?.role] || user?.role}</Text>
        <Text style={styles.profileMobile}>{user?.mobile}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Main Nav */}
        <View style={styles.section}>
          {navItem('Home', '🏠', user?.role === 'admin' ? 'AdminHome' : 'ManagerHome')}
          {user?.role === 'admin' && navItem('Add New Manager', '👔', 'CreateManager')}
          {user?.role === 'admin' && viewingManager && navItem(`Add Worker for ${viewingManager.name}`, '➕', 'CreateWorker', { forManagerId: viewingManager._id, managerName: viewingManager.name })}
          {user?.role === 'manager' && navItem('Add New Worker', '➕', 'CreateWorker')}
          {user?.role === 'admin' && navItem('Disabled Workers', '🚫', 'DisabledWorkers')}
          {user?.role === 'admin' && navItem('Balance Payment', '💰', 'BalancePayment')}
        </View>

        {/* Disabled Workers */}
        {disabled.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DISABLED WORKERS</Text>
            {loading ? <ActivityIndicator color={COLORS.primary} /> : disabled.map(w => (
              <TouchableOpacity key={w._id} style={styles.inactiveItem} onLongPress={() => reactivate(w)}>
                <View style={styles.inactiveAvatar}><Text style={styles.inactiveAvatarText}>{w.name[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inactiveName}>{w.name}</Text>
                  <Text style={styles.inactiveRole}>{ROLE_LABELS[w.role]}</Text>
                </View>
                <View style={styles.statusPill}><Text style={styles.statusPillText}>Disabled</Text></View>
              </TouchableOpacity>
            ))}
            {disabled.length > 0 && <Text style={styles.holdHint}>Hold to reactivate</Text>}
          </View>
        )}

        {/* Long Leave Workers section removed */}

        {/* Bottom Nav */}
        <View style={[styles.section, { marginTop: 'auto' }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => { navigation.closeDrawer(); navigation.navigate('HiddenWorkers'); }}>
            <Text style={styles.navIcon}>👻</Text>
            <Text style={styles.navLabel}>Hidden Workers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navItem, { borderTopWidth: 1, borderTopColor: COLORS.border }]}
            onPress={() => Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }])}>
            <Text style={styles.navIcon}>🚪</Text>
            <Text style={[styles.navLabel, { color: COLORS.red }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  profileHeader: { backgroundColor: COLORS.primary, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center' },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  profileAvatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  profileRole: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  profileMobile: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  section: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  navIcon: { fontSize: 18, marginRight: 14 },
  navLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  inactiveItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  inactiveAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFEAEE', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  inactiveAvatarText: { color: COLORS.red, fontWeight: '700', fontSize: 14 },
  inactiveName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  inactiveRole: { fontSize: 12, color: COLORS.textSecondary },
  statusPill: { backgroundColor: '#FFEAEE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 11, color: COLORS.red, fontWeight: '600' },
  holdHint: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 6 },
  hiddenSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 2 },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 20, marginBottom: 14 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  sheetItemIcon: { fontSize: 20, marginRight: 14 },
  sheetItemText: { fontSize: 16, color: COLORS.textPrimary },
});
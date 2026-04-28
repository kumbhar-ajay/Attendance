// FILE: mobile/src/screens/HiddenWorkers.js
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getHiddenWorkers, toggleHideWorker } from '../api';
import { COLORS, ROLE_LABELS } from '../config';
import { useStore } from '../store';

export default function HiddenWorkers({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useStore();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useFocusEffect(
    useCallback(() => { fetchWorkers(); }, [])
  );

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const res = await getHiddenWorkers();
      setWorkers(res.data.data);
    } catch { Toast.show({ type: 'error', text1: 'Failed to load' }); }
    finally { setLoading(false); }
  };

  const handleUnhide = async () => {
    try {
      await toggleHideWorker(selected._id);
      Toast.show({ type: 'success', text1: `${selected.name} is visible again` });
      setShowMenu(false);
      setSelected(null);
      fetchWorkers();
    } catch { Toast.show({ type: 'error', text1: 'Failed' }); }
  };

  const menuItems = [
    { label: 'View Month History', icon: '📅', action: () => { setShowMenu(false); navigation.navigate('MonthHistory', { worker: selected }); } },
    { label: 'Edit Previous Attendance', icon: '✏️', action: () => { setShowMenu(false); navigation.navigate('MonthHistory', { worker: selected, editMode: true }); } },
    { label: 'Unhide from Home', icon: '👁', action: handleUnhide },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.hamburger}>
          <Text style={styles.hamburgerText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hidden Workers</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : workers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👻</Text>
          <Text style={styles.emptyText}>No hidden workers</Text>
          <Text style={styles.emptyHint}>Workers hidden from the home screen will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={w => w._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: w }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{w.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{w.name}</Text>
                <Text style={styles.sub}>
                  {user?.role === 'manager' ? ROLE_LABELS[w.role] : `${ROLE_LABELS[w.role]} · ₹${w.rate}/day`}
                </Text>
              </View>
              <TouchableOpacity style={styles.moreBtn} onPress={() => { setSelected(w); setShowMenu(true); }}>
                <Text style={styles.moreBtnText}>•••</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Action Menu */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowMenu(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{selected?.name}</Text>
            <Text style={styles.sheetSub}>
              {user?.role === 'manager' ? ROLE_LABELS[selected?.role] : `${ROLE_LABELS[selected?.role]} · ₹${selected?.rate}/day`}
            </Text>
            {menuItems.map((item, i) => (
              <TouchableOpacity key={i} style={styles.sheetItem} onPress={item.action}>
                <Text style={styles.sheetIcon}>{item.icon}</Text>
                <Text style={styles.sheetLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: COLORS.border }]} onPress={() => setShowMenu(false)}>
              <Text style={[styles.sheetLabel, { color: COLORS.textSecondary, textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, paddingBottom: 14, paddingHorizontal: 16 },
  hamburger: { padding: 6, width: 40 },
  hamburgerText: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  moreBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  moreBtnText: { color: COLORS.textSecondary, fontSize: 18, letterSpacing: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 2 },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 20, marginBottom: 14 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  sheetIcon: { fontSize: 20, marginRight: 14 },
  sheetLabel: { fontSize: 16, color: COLORS.textPrimary },
});

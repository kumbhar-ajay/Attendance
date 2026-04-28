// FILE: mobile/src/screens/AdminHome.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput, Alert, Platform, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getManagers, createManager, deleteManager, getReport, getBalancePayment, adminChangePassword, adminChangeRate } from '../api';
import { useStore } from '../store';
import { COLORS } from '../config';

const currMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

export default function AdminHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, setViewingManager } = useStore();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState([]);
  const [balance, setBalance] = useState(null);
  const [month, setMonth] = useState(currMonth());
  const [showCreateMgr, setShowCreateMgr] = useState(false);
  const [mgrName, setMgrName] = useState('');
  const [mgrMobile, setMgrMobile] = useState('');
  const [mgrRate, setMgrRate] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedMgr, setSelectedMgr] = useState(null);
  const [showMgrMenu, setShowMgrMenu] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [showPassInput, setShowPassInput] = useState(false);

  // Re-fetch whenever screen comes into focus (e.g. after navigating back)
  useFocusEffect(
    useCallback(() => { fetchManagers(); }, [])
  );

  useEffect(() => { fetchAll(); }, [month]);

  const onRefresh = useCallback(() => { fetchAll(); }, [month]);

  const fetchManagers = async () => {
    try {
      const mRes = await getManagers();
      setManagers(mRes.data.data);
    } catch (e) { /* silently ignore */ }
    finally { setLoading(false); }
  };

  const fetchAll = async () => {
    setLoading(true);
    // Fetch managers and report independently so one failure doesn't block the other
    try {
      const mRes = await getManagers();
      setManagers(mRes.data.data);
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed to load managers' }); }
    try {
      const rRes = await getReport(month);
      setReport(rRes.data.data);
    } catch (e) { /* report errors are non-critical */ }
    try {
      const bRes = await getBalancePayment(month);
      setBalance(bRes.data.data);
    } catch (e) { /* balance errors are non-critical */ }
    setLoading(false);
  };

  const handleCreateMgr = async () => {
    if (!mgrName.trim() || !mgrMobile.trim()) { Toast.show({ type: 'error', text1: 'Name and mobile required' }); return; }
    if (mgrMobile.length !== 10) { Toast.show({ type: 'error', text1: '10-digit mobile required' }); return; }
    if (!mgrRate || isNaN(mgrRate) || Number(mgrRate) <= 0) { Toast.show({ type: 'error', text1: 'Enter valid daily rate' }); return; }
    setCreating(true);
    try {
      await createManager({ name: mgrName.trim(), mobile: mgrMobile.trim(), rate: Number(mgrRate) });
      Toast.show({ type: 'success', text1: `Manager ${mgrName} created!`, text2: `Default password: ${mgrMobile}` });
      setShowCreateMgr(false); setMgrName(''); setMgrMobile(''); setMgrRate('');
      fetchManagers(); // immediately reload manager list
    } catch (e) { Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed to create manager' }); }
    finally { setCreating(false); }
  };

  const handleChangePass = async () => {
    if (!newPass || newPass.length < 6) { Toast.show({ type: 'error', text1: 'Min 6 characters' }); return; }
    try {
      await adminChangePassword(selectedMgr._id, newPass);
      Toast.show({ type: 'success', text1: 'Password updated!' });
      setShowPassInput(false); setShowMgrMenu(false); setNewPass('');
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed' }); }
  };

  const changeMonth = (dir) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    if (d > new Date()) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const totalWorkers = managers.reduce((s, m) => s + (m.workerCount || 0), 0);
  const totalAdvance = report.reduce((s, r) => s + (r.totalAdvance || 0), 0);
  const netBalance = balance?.totalBalance ?? null;

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.hamburger}><Text style={{ color: '#fff', fontSize: 22 }}>☰</Text></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Logout','Exit?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])}>
          <Text style={{ color: '#fff', fontSize: 13 }}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statVal}>{managers.length}</Text><Text style={styles.statLabel}>Managers</Text></View>
          <View style={styles.statCard}><Text style={styles.statVal}>{totalWorkers}</Text><Text style={styles.statLabel}>Workers</Text></View>
          <View style={styles.statCard}><Text style={[styles.statVal, { color: COLORS.red }]}>₹{totalAdvance.toLocaleString()}</Text><Text style={styles.statLabel}>Advance ({month.slice(5)})</Text></View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.statVal, { color: COLORS.green }]}>{netBalance !== null ? `₹${Math.abs(netBalance).toLocaleString()}` : '...'}</Text>
            <Text style={styles.statLabel}>Balance to Pay ({month.slice(5)})</Text>
          </View>
        </View>

        {/* Managers */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Managers</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateMgr(true)}>
            <Text style={styles.addBtnText}>+ Add Manager</Text>
          </TouchableOpacity>
        </View>
        {managers.map(m => (
          <TouchableOpacity key={m._id} style={styles.mgrCard}
            onPress={() => { setViewingManager(m); navigation.navigate('ManagerHome'); }}
            onLongPress={() => { setSelectedMgr(m); setShowMgrMenu(true); }}>
            <View style={styles.mgrAvatar}><Text style={styles.mgrAvatarText}>{m.name[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mgrName}>{m.name}</Text>
              <Text style={styles.mgrSub}>{m.workerCount || 0} workers · {m.mobile} · ₹{m.rate || 0}/day</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: m.status === 'active' ? COLORS.green : COLORS.red }]} />
          </TouchableOpacity>
        ))}

        {/* Monthly Report */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Report</Text>
        </View>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={styles.navArrow}>‹</Text></TouchableOpacity>
          <Text style={styles.monthLabel}>{new Date(month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Text style={styles.navArrow}>›</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              {['Name','Role','Days','Rate','Earned','Adv.','Travel','Balance'].map(h => (
                <Text key={h} style={[styles.cell, styles.headCell]}>{h}</Text>
              ))}
            </View>
            {report.map((r, i) => (
              <View key={i} style={[styles.tableRow, i%2===0 && {backgroundColor:'#F9F9F9'}]}>
                <Text style={styles.cell}>{r.name}</Text>
                <Text style={styles.cell}>{r.role}</Text>
                <Text style={styles.cell}>{r.totalDays}</Text>
                <Text style={styles.cell}>{r.rate}</Text>
                <Text style={styles.cell}>₹{r.earned}</Text>
                <Text style={styles.cell}>₹{r.totalAdvance}</Text>
                <Text style={styles.cell}>₹{r.totalTravel}</Text>
                <Text style={[styles.cell, { color: r.balance >= 0 ? COLORS.green : COLORS.red, fontWeight: '700' }]}>₹{r.balance?.toFixed(0)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Create Manager Modal */}
      <Modal visible={showCreateMgr} transparent animationType="slide" onRequestClose={() => setShowCreateMgr(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCreateMgr(false)} />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Create Manager</Text>
            <Text style={styles.formLabel}>Full Name</Text>
            <TextInput style={styles.input} placeholder="Enter manager name" value={mgrName} onChangeText={setMgrName} />
            <Text style={styles.formLabel}>Mobile Number</Text>
            <TextInput style={styles.input} placeholder="10-digit mobile" keyboardType="numeric" maxLength={10} value={mgrMobile} onChangeText={setMgrMobile} />
            <Text style={styles.formLabel}>Daily Rate (₹)</Text>
            <TextInput style={styles.input} placeholder="Daily rate" keyboardType="numeric" value={mgrRate} onChangeText={setMgrRate} />
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 }}>Default password will be mobile number</Text>
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateMgr} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Manager</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* Manager Menu */}
      <Modal visible={showMgrMenu} transparent animationType="slide" onRequestClose={() => setShowMgrMenu(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowMgrMenu(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{selectedMgr?.name}</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMgrMenu(false); setShowPassInput(true); }}>
            <Text style={styles.menuItemText}>🔑 Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setShowMgrMenu(false);
            Alert.alert('Remove Manager', `Delete ${selectedMgr?.name}? This cannot be undone.`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await deleteManager(selectedMgr._id);
                  Toast.show({ type: 'success', text1: `${selectedMgr.name} removed` });
                  fetchManagers();
                } catch (e) { Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed to remove' }); }
              }}
            ]);
          }}>
            <Text style={[styles.menuItemText, { color: COLORS.red }]}>🗑 Remove Manager</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowMgrMenu(false)}>
            <Text style={[styles.menuItemText, { color: COLORS.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Password Input Modal */}
      <Modal visible={showPassInput} transparent animationType="fade" onRequestClose={() => setShowPassInput(false)}>
        <View style={styles.overlay}>
          <View style={styles.alertBox}>
            <Text style={styles.sheetTitle}>Change Password for {selectedMgr?.name}</Text>
            <TextInput style={styles.input} placeholder="New Password" secureTextEntry value={newPass} onChangeText={setNewPass} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: COLORS.border }]} onPress={() => setShowPassInput(false)}>
                <Text style={{ color: COLORS.textPrimary, fontWeight: '600', textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={handleChangePass}>
                <Text style={styles.submitBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingBottom: 12, paddingHorizontal: 16 },
  hamburger: { marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerDate: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  mgrCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  mgrAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  mgrAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  mgrName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  mgrSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  navArrow: { fontSize: 22, color: COLORS.primary, fontWeight: '700' },
  monthLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  table: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  tableRow: { flexDirection: 'row' },
  tableHead: { backgroundColor: COLORS.bg },
  cell: { width: 90, paddingHorizontal: 8, paddingVertical: 10, fontSize: 12, color: COLORS.textPrimary, borderRightWidth: 0.5, borderRightColor: COLORS.border },
  headCell: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 11 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 13, fontSize: 15, marginBottom: 12 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  menuItem: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  menuItemText: { fontSize: 16, color: COLORS.textPrimary },
  alertBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, margin: 24 },
});
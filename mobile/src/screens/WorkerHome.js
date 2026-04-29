// FILE: mobile/src/screens/WorkerHome.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform, RefreshControl, Alert, Switch, Modal, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { getMyAttendance, updateTravel, changePassword } from '../api';
import { useStore } from '../store';
import { COLORS, ATT_MAP, ROLE_LABELS } from '../config';

const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const currMonth = (ref) => { const d = ref ? new Date(ref + 'T12:00:00') : new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function WorkerHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, testMode, testDate, setTestMode, changeTestDate } = useStore();
  const workDate = (testMode && testDate) ? testDate : localDateStr();
  const [month, setMonth] = useState(currMonth(workDate));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [travel, setTravel] = useState('');
  const [savingTravel, setSavingTravel] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showPassModal, setShowPassModal] = useState(false);
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [editTravelDate, setEditTravelDate] = useState(null);
  const [editTravelAmt, setEditTravelAmt] = useState('');
  const [showTravelEditModal, setShowTravelEditModal] = useState(false);
  const [savingTravelEdit, setSavingTravelEdit] = useState(false);

  useEffect(() => { NetInfo.addEventListener(s => setIsOnline(s.isConnected)); }, []);
  useEffect(() => { const wm = workDate.substring(0, 7); if (wm !== month) setMonth(wm); }, [workDate]);
  useEffect(() => { fetchData(); }, [month, workDate]);

  const fetchData = async () => {
    try {
      const res = await getMyAttendance(month);
      setData(res.data.data);
      const today = res.data.data.attendances.find(a => a.date?.startsWith(workDate));
      if (today?.travelExpense) setTravel(String(today.travelExpense));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load' });
    } finally { setLoading(false); setRefreshing(false); }
  };

  const handleSaveTravelEdit = async () => {
    if (editTravelAmt === '' || isNaN(editTravelAmt) || Number(editTravelAmt) < 0) { Toast.show({ type: 'error', text1: 'Enter valid amount' }); return; }
    setSavingTravelEdit(true);
    try {
      await updateTravel(editTravelDate, Number(editTravelAmt));
      Toast.show({ type: 'success', text1: 'Travel updated!' });
      setShowTravelEditModal(false); setEditTravelDate(null); setEditTravelAmt('');
      fetchData();
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed to save' }); }
    finally { setSavingTravelEdit(false); }
  };

  const handleSaveTravel = async () => {
    if (!travel || isNaN(travel) || Number(travel) < 0) { Toast.show({ type: 'error', text1: 'Enter valid amount' }); return; }
    setSavingTravel(true);
    try {
      await updateTravel(workDate, Number(travel));
      Toast.show({ type: 'success', text1: 'Travel expense saved!' });
      fetchData();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to save' });
    } finally { setSavingTravel(false); }
  };

  const changeMonth = (dir) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const cutoff = new Date(workDate + 'T12:00:00');
    if (d > cutoff) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const handleChangePassword = async () => {
    if (!curPass || !newPass || !confirmPass) { Toast.show({ type: 'error', text1: 'Fill all fields' }); return; }
    if (newPass !== confirmPass) { Toast.show({ type: 'error', text1: 'Passwords do not match' }); return; }
    if (newPass.length < 6) { Toast.show({ type: 'error', text1: 'Min 6 characters required' }); return; }
    try {
      await changePassword(curPass, newPass);
      Toast.show({ type: 'success', text1: 'Password changed!' });
      setShowPassModal(false); setCurPass(''); setNewPass(''); setConfirmPass('');
    } catch (e) {
      Toast.show({ type: 'error', text1: e.response?.data?.message || 'Failed' });
    }
  };

  const buildDateRows = () => {
    if (!data) return [];
    const attMap = {};
    const advMap = {};
    data.attendances?.forEach(a => { attMap[a.date?.substring(0, 10)] = a; });
    data.advances?.forEach(a => { const ds = a.date?.substring(0, 10); advMap[ds] = (advMap[ds] || 0) + a.amount; });
    const [y, mo] = month.split('-').map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const cutoff = new Date(workDate + 'T23:59:59');
    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (new Date(ds + 'T00:00:00') > cutoff) break;
      rows.push({ dateStr: ds, att: attMap[ds] || null, adv: advMap[ds] || 0 });
    }
    return rows;
  };

  const todayAtt = data?.attendances?.find(a => a.date?.startsWith(workDate));
  const todayAttVal = todayAtt?.value;
  const attColor = todayAttVal ? (ATT_MAP[todayAttVal]?.color || COLORS.primary) : COLORS.textSecondary;

  if (!isOnline) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 32 }}>
        <Text style={{ fontSize: 48 }}>📡</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 }}>No Internet</Text>
        <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 }}>Please connect to continue</Text>
        <TouchableOpacity style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, marginTop: 24, paddingHorizontal: 32 }} onPress={fetchData}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{ROLE_LABELS[user?.role]} — {user?.name}</Text>
          <Text style={styles.headerDate}>{new Date(workDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}{testMode ? ' 🧪' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowPassModal(true)} style={{ marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 13 }}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Logout','Are you sure?',[{text:'Cancel'},{text:'Logout',style:'destructive',onPress:logout}])}>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Logout</Text>
        </TouchableOpacity>
        <View style={[styles.dot, { backgroundColor: isOnline ? COLORS.green : COLORS.red, marginLeft: 10 }]} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={[COLORS.primary]} />} contentContainerStyle={{ padding: 16 }}>
          {/* Today Card */}
          <View style={styles.todayCard}>
            <Text style={styles.todayLabel}>Today's Attendance</Text>
            <Text style={[styles.todayValue, { color: attColor }]}>
              {todayAttVal ? (ATT_MAP[todayAttVal]?.display || todayAttVal) : '—'}
            </Text>
            <Text style={styles.todayDate}>{new Date(workDate + 'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}{testMode ? ' 🧪' : ''}</Text>
            {!todayAttVal && <Text style={styles.notMarked}>Not marked yet</Text>}
          </View>

          {/* Travel Input */}
          <View style={styles.travelCard}>
            <Text style={styles.travelLabel}>{testMode ? 'Travel Expense (Test Date) 🧪' : "Today's Travel Expense"}</Text>
            <View style={styles.travelRow}>
              <Text style={styles.travelPrefix}>₹</Text>
              <TextInput style={styles.travelInput} placeholder="0" keyboardType="numeric" value={travel} onChangeText={setTravel} />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTravel} disabled={savingTravel}>
                {savingTravel ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Month Summary */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>{data?.totalDays?.toFixed(1) || '0'}</Text>
              <Text style={styles.statLabel}>Days Present</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>₹{data?.totalAdvance || 0}</Text>
              <Text style={styles.statLabel}>Advance Taken</Text>
            </View>
          </View>
          <View style={[styles.statsRow, { marginTop: -8 }]}>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: COLORS.primary }]}>₹{data?.totalTravel || 0}</Text>
              <Text style={styles.statLabel}>Total Travel</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: COLORS.green }]}>₹{data?.balance?.toFixed(0) || 0}</Text>
              <Text style={styles.statLabel}>Balance</Text>
            </View>
          </View>

          {/* Test Mode */}
          <View style={styles.testModeCard}>
            <View style={styles.testModeRow}>
              <Text style={styles.testModeLabel}>🧪 Manual Date Mode</Text>
              <Switch value={testMode} onValueChange={setTestMode} trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor={testMode ? '#fff' : '#f4f3f4'} />
            </View>
            {testMode && (
              <View style={styles.dateNavRow}>
                <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeTestDate(-1)}><Text style={styles.dateNavArrow}>‹</Text></TouchableOpacity>
                <Text style={styles.dateNavText}>{workDate}</Text>
                <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeTestDate(1)}><Text style={styles.dateNavArrow}>›</Text></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Month Nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavBtn}><Text style={styles.monthNavArrow}>‹</Text></TouchableOpacity>
            <Text style={styles.monthNavLabel}>{new Date(month + '-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavBtn}><Text style={styles.monthNavArrow}>›</Text></TouchableOpacity>
          </View>

          {/* History Table */}
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {['Date','Att.','Travel','Advance','By'].map(h => (
                <Text key={h} style={[styles.tableCell, styles.tableHeaderText]}>{h}</Text>
              ))}
            </View>
            {(() => {
              const rows = buildDateRows();
              const sumTravel = rows.reduce((s, { att }) => s + (att?.travelExpense || 0), 0);
              const sumAdv = rows.reduce((s, { adv }) => s + adv, 0);
              return (
                <>
                  {rows.map(({ dateStr, att, adv }, i) => {
                    const attInfo = att ? ATT_MAP[att.value] : null;
                    const isMissing = !att;
                    return (
                      <View key={dateStr} style={[styles.tableRow, i % 2 === 0 && { backgroundColor: '#FAFAFA' }, isMissing && { opacity: 0.55 }]}>
                        <Text style={[styles.tableCell, { color: COLORS.textSecondary }]}>{fmtDate(dateStr)}</Text>
                        <Text style={[styles.tableCell, { color: isMissing ? COLORS.red : (attInfo?.color || COLORS.textPrimary), fontWeight: '700' }]}>{att ? (attInfo?.display || att.value) : 'A'}</Text>
                        <View style={[styles.tableCell, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
                          <Text style={{ fontSize: 13, color: COLORS.textPrimary }}>{att?.travelExpense > 0 ? `₹${att.travelExpense}` : '—'}</Text>
                          {att && (
                            <TouchableOpacity onPress={() => { setEditTravelDate(dateStr); setEditTravelAmt(att?.travelExpense ? String(att.travelExpense) : ''); setShowTravelEditModal(true); }} style={{ marginLeft: 2 }}>
                              <Text style={{ fontSize: 13, color: COLORS.primary }}>✏</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.tableCell}>{adv > 0 ? `₹${adv}` : '—'}</Text>
                        <Text style={[styles.tableCell, { fontSize: 11, color: COLORS.textSecondary }]}>{att?.markedBy?.name || '—'}</Text>
                      </View>
                    );
                  })}
                  {/* Sum row */}
                  <View style={[styles.tableRow, styles.tableSumRow]}>
                    <Text style={[styles.tableCell, { fontWeight: '700', color: COLORS.textPrimary }]}>Total</Text>
                    <Text style={styles.tableCell}></Text>
                    <Text style={[styles.tableCell, { fontWeight: '700', color: COLORS.primary }]}>{sumTravel > 0 ? `₹${sumTravel}` : '—'}</Text>
                    <Text style={[styles.tableCell, { fontWeight: '700', color: COLORS.amber }]}>{sumAdv > 0 ? `₹${sumAdv}` : '—'}</Text>
                    <Text style={styles.tableCell}></Text>
                  </View>
                </>
              );
            })()}
          </View>
        </ScrollView>
      )}

      {/* Travel Edit Modal */}
      <Modal visible={showTravelEditModal} transparent animationType="slide" onRequestClose={() => setShowTravelEditModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 20}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowTravelEditModal(false)} />
          <View style={styles.passModal}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 4 }}>Edit Travel Expense</Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 }}>{editTravelDate ? new Date(editTravelDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : ''}</Text>
            <View style={styles.travelRow}>
              <Text style={styles.travelPrefix}>₹</Text>
              <TextInput style={styles.travelInput} placeholder="0" keyboardType="numeric" value={editTravelAmt} onChangeText={setEditTravelAmt} autoFocus />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 14 }]} onPress={handleSaveTravelEdit} disabled={savingTravelEdit}>
              {savingTravelEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPassModal} transparent animationType="slide" onRequestClose={() => setShowPassModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 20}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowPassModal(false)} />
          <View style={styles.passModal}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Change Password</Text>
            {[
              { label: 'Current Password', placeholder: 'Current password', val: curPass, set: setCurPass },
              { label: 'New Password', placeholder: 'New password (min 6)', val: newPass, set: setNewPass },
              { label: 'Confirm New Password', placeholder: 'Confirm new password', val: confirmPass, set: setConfirmPass },
            ].map((f, i) => (
              <View key={i}>
                <Text style={styles.passLabel}>{f.label}</Text>
                <TextInput style={styles.passInput} placeholder={f.placeholder} value={f.val} onChangeText={f.set} />
              </View>
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}>
              <Text style={styles.saveBtnText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingBottom: 14, paddingHorizontal: 16 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerDate: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  todayCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: COLORS.border },
  todayLabel: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  todayValue: { fontSize: 52, fontWeight: '800', letterSpacing: 2 },
  todayDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  notMarked: { fontSize: 13, color: '#999', fontStyle: 'italic', marginTop: 4 },
  travelCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  travelLabel: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 10 },
  travelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  travelPrefix: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary },
  travelInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  monthNavBtn: { padding: 4 },
  monthNavArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '600' },
  monthNavLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  table: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12 },
  tableHeader: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableCell: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  tableHeaderText: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 12 },
  tableSumRow: { backgroundColor: '#EEF4FF', borderTopWidth: 1, borderTopColor: COLORS.border },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  passModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  passLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  passInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  testModeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  testModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testModeLabel: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  dateNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 16 },
  dateNavBtn: { padding: 6 },
  dateNavArrow: { fontSize: 26, color: COLORS.primary, fontWeight: '700' },
  dateNavText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, minWidth: 100, textAlign: 'center' },
});
// FILE: mobile/src/screens/WorkerHome.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Platform, RefreshControl, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { getMyAttendance, updateTravel, changePassword } from '../api';
import { useStore } from '../store';
import { COLORS, ATT_MAP, ROLE_LABELS } from '../config';

const currMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const todayStr = new Date().toISOString().split('T')[0];

export default function WorkerHome({ navigation }) {
  const { user, logout } = useStore();
  const [month, setMonth] = useState(currMonth());
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

  useEffect(() => {
    NetInfo.addEventListener(s => setIsOnline(s.isConnected));
    fetchData();
  }, [month]);

  const fetchData = async () => {
    try {
      const res = await getMyAttendance(month);
      setData(res.data.data);
      const today = res.data.data.attendances.find(a => a.date?.startsWith(todayStr));
      if (today?.travelExpense) setTravel(String(today.travelExpense));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load' });
    } finally { setLoading(false); setRefreshing(false); }
  };

  const handleSaveTravel = async () => {
    if (!travel || isNaN(travel) || Number(travel) < 0) { Toast.show({ type: 'error', text1: 'Enter valid amount' }); return; }
    setSavingTravel(true);
    try {
      await updateTravel(todayStr, Number(travel));
      Toast.show({ type: 'success', text1: 'Travel expense saved!' });
      fetchData();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to save' });
    } finally { setSavingTravel(false); }
  };

  const changeMonth = (dir) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const now = new Date();
    if (d > now) return;
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

  const todayAtt = data?.attendances?.find(a => a.date?.startsWith(todayStr));
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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{ROLE_LABELS[user?.role]} — {user?.name}</Text>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</Text>
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
            <Text style={styles.todayDate}>{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</Text>
            {!todayAttVal && <Text style={styles.notMarked}>Not marked yet</Text>}
          </View>

          {/* Travel Input */}
          <View style={styles.travelCard}>
            <Text style={styles.travelLabel}>Today's Travel Expense</Text>
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
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: COLORS.green }]}>₹{data?.balance?.toFixed(0) || 0}</Text>
              <Text style={styles.statLabel}>Balance</Text>
            </View>
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
              {['Date','Att.','Travel','Advance'].map(h => (
                <Text key={h} style={[styles.tableCell, styles.tableHeaderText, h === 'Date' && { flex: 1.2 }]}>{h}</Text>
              ))}
            </View>
            {data?.attendances?.length === 0 && (
              <Text style={{ textAlign: 'center', padding: 20, color: COLORS.textSecondary }}>No records for this month</Text>
            )}
            {data?.attendances?.map((att, i) => {
              const dayAdv = data.advances?.filter(a => a.date?.startsWith(att.date?.substring(0,10))).reduce((s,a) => s + a.amount, 0);
              return (
                <View key={i} style={[styles.tableRow, i % 2 === 0 && { backgroundColor: '#FAFAFA' }]}>
                  <Text style={[styles.tableCell, { flex: 1.2, color: COLORS.textSecondary }]}>{fmtDate(att.date)}</Text>
                  <Text style={[styles.tableCell, { color: ATT_MAP[att.value]?.color || COLORS.textPrimary, fontWeight: '700' }]}>{ATT_MAP[att.value]?.display || att.value}</Text>
                  <Text style={styles.tableCell}>{att.travelExpense > 0 ? `₹${att.travelExpense}` : '—'}</Text>
                  <Text style={styles.tableCell}>{dayAdv > 0 ? `₹${dayAdv}` : '—'}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Change Password Modal */}
      {showPassModal && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowPassModal(false)} />
          <View style={styles.passModal}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Change Password</Text>
            {[
              { placeholder: 'Current password', val: curPass, set: setCurPass },
              { placeholder: 'New password (min 6)', val: newPass, set: setNewPass },
              { placeholder: 'Confirm new password', val: confirmPass, set: setConfirmPass },
            ].map((f, i) => (
              <TextInput key={i} style={styles.passInput} placeholder={f.placeholder} secureTextEntry value={f.val} onChangeText={f.set} />
            ))}
            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}>
              <Text style={styles.saveBtnText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingTop: Platform.OS === 'android' ? 40 : 52, paddingBottom: 14, paddingHorizontal: 16 },
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
  passModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  passInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
});
// FILE: mobile/src/screens/ManagerHome.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Modal, ScrollView, ActivityIndicator, Alert, RefreshControl, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { getTodayAttendance, markAttendance, addAdvance, deleteAdvance, fillAbsent, updateWorkerStatus } from '../api';
import { useStore } from '../store';
import { COLORS, ATT_MAP, QUICK_ATT, MORE_ATT, QUICK_ADV, ROLE_LABELS } from '../config';

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const todayDateLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const AttBadge = ({ value }) => {
  if (!value || value === '0') return null;
  const m = ATT_MAP[value];
  return <View style={[styles.attBadge, { backgroundColor: m?.color || COLORS.primary }]}><Text style={styles.attBadgeText}>{m?.display || value}</Text></View>;
};

const Avatar = ({ name, photoUrl, size = 42 }) => {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
};

export default function ManagerHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, testMode, testDate, viewingManager, clearViewingManager } = useStore();
  const workDate = (testMode && testDate) ? testDate : todayStr;
  const dateLabel = testMode && testDate
    ? new Date(testDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : todayDateLabel;
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [noInternet, setNoInternet] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoreAtt, setShowMoreAtt] = useState(null);
  const [showAdvInput, setShowAdvInput] = useState(null);
  const [advAmount, setAdvAmount] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [advLoading, setAdvLoading] = useState({});

  useEffect(() => {
    const netUnsub = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (!state.isConnected) setNoInternet(true);
      else { setNoInternet(false); }
    });
    return () => netUnsub();
  }, []);

  // Re-fetch every time this screen comes into focus (e.g. after adding a worker)
  useFocusEffect(
    useCallback(() => { fetchData(workDate); }, [testMode, testDate])
  );

  const fetchData = async (date) => {
    const d = date || workDate;
    const managerId = user?.role === 'admin' && viewingManager ? viewingManager._id : undefined;
    try {
      const [wRes, logRes] = await Promise.all([getTodayAttendance(d, managerId), getActionLog()]);
      setWorwRes = await getTodayAttendance(d, managerId);
      setWorkers(wRes.data.data
      if (e.response?.status !== 401) Toast.show({ type: 'error', text1: 'Failed to load data' });
    } finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); fetchData(workDate); };

  const setWorkerField = (workerId, updates) => {
    setWorkers(prev => prev.map(w => w._id === workerId ? { ...w, ...updates } : w));
  };

  const handleMarkAttendance = async (worker, value) => {
    if (actionLoading[worker._id]) return;
    setActionLoading(p => ({ ...p, [worker._id]: true }));
    try {
      const { data } = await markAttendance(worker._id, workDate, value);
      setWorkerField(worker._id, { todayAttendance: { value, _id: data.data.attId } });
      const logRes = await getActionLog();
      catch (e) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e.response?.data?.message || 'Try again' });
    } finally { setActionLoading(p => ({ ...p, [worker._id]: false })); }
  };

  const handleAddAdvance = async (worker, amount) => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) { Toast.show({ type: 'error', text1: 'Enter valid amount' }); return; }
    if (advLoading[worker._id]) return;
    setAdvLoading(p => ({ ...p, [worker._id]: true }));
    try {
      const res = await addAdvance(worker._id, Number(amount), workDate);
      setWorkerField(worker._id, { todayAdvance: Number(amount), todayAdvanceId: res.data.data._id });
      const logRes = await getActionLog();
      setUndoLogs(logRes.data.data || []);
      Toast.show({ type: 'success', text1: `₹${amount} advance added for ${worker.name}` });
      Toast.show({ type: 'error', text1: 'Failed', text2: e.response?.data?.message || 'Try again' });
    } finally { setAdvLoading(p => ({ ...p, [worker._id]: false })); }
  };

  const handleRemoveAdvance = async (worker) => {
    if (!worker.todayAdvanceId) { Toast.show({ type: 'error', text1: 'No advance to remove' }); return; }
    Alert.alert('Remove Advance', `Remove ₹${worker.todayAdvance} advance for ${worker.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await deleteAdvance(worker.todayAdvanceId);
          setWorkerField(worker._id, { todayAdvance: 0, todayAdvanceId: null });
          Toast.show({ type: 'success', text1: `Advance removed for ${worker.name}` });
        } catch (e) {
          Toast.show({ type: 'error', text1: 'Failed to remove advance' });
        }
      }}
    ]);
  };

  const handleUndo = async (log) => {
    Alert.alert('Undo Action', `Reverse: ${log.actionType.replace(/_/g,' ')} for ${log.targetUser?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: async () => {
  { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: async () => {
        try {
          await updateWorkerStatus(selectedWorker._id, 'disabled');
          Toast.show({ type: 'success', text1: `${selectedWorker.name} disabled` });
          setShowMenu(false); fetchData();
        } catch (e) { Toast.show({ type: 'error', text1: 'Failed' }); }
      }}
    ]);
  };

  const getFilteredWorkers = () => {
    let filtered = workers.filter(w => !w.isHidden);
    if (search.trim()) filtered = filtered.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'Pending') filtered = filtered.filter(w => !w.todayAttendance);
    else if (filter === 'Mistry') filtered = filtered.filter(w => w.role === 'mistry');
    else if (filter === 'Labour') filtered = filtered.filter(w => w.role === 'labour');
    else if (filter === 'Half Mistry') filtered = filtered.filter(w => w.role === 'half_mistry');
    // Backend already sorts: attendance marked first, then by role, then by name
    return filtered;
  };

  const marked = workers.filter(w => w.todayAttendance).length;
  const total = workers.filter(w => !w.isHidden).length;
  const filtered = getFilteredWorkers();
  const filters = ['All', 'Pending', 'Mistry', 'Labour', 'Half Mistry'];

  const renderWorker = ({ item: w, index }) => {
    const isMarked = !!w.todayAttendance;
    const currentAtt = w.todayAttendance?.value;

    return (
      <View style={[styles.workerCard, isMarked && styles.workerCardFaded]}>
        <View style={styles.workerTop}>
          <View style={styles.serialBadge}><Text style={styles.serialText}>{index + 1}</Text></View>
          <Avatar name={w.name} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.workerName}>{w.name}</Text>
            <Text style={styles.workerSub}>{ROLE_LABELS[w.role]} · ₹{w.rate}/day</Text>
          </View>
          {isMarked && <AttBadge value={currentAtt} />}
          <TouchableOpacity onPress={() => { setSelectedWorker(w); setShowMenu(true); }} style={styles.moreBtn}>
            <Text style={styles.moreBtnText}>•••</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attRow}>
          {QUICK_ATT.map(a => (
            <TouchableOpacity
              key={a.value}
              style={[styles.attBtn, currentAtt === a.value && { backgroundColor: ATT_MAP[a.value]?.color || COLORS.primary, borderColor: ATT_MAP[a.value]?.color }]}
              onPress={() => handleMarkAttendance(w, a.value)}
              disabled={!!actionLoading[w._id]}
            >
              {actionLoading[w._id] && currentAtt !== a.value ? null :
                <Text style={[styles.attBtnText, currentAtt === a.value && { color: '#fff' }]}>{a.label}</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.attBtn} onPress={() => setShowMoreAtt(w._id)}>
            <Text style={styles.attBtnText}>+</Text>
          </TouchableOpacity>
          {actionLoading[w._id] && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
        </ScrollView>

        <View style={styles.advRow}>
          <Text style={styles.advLabel}>Adv:</Text>
          {w.todayAdvance > 0 ? (
            <>
              <TouchableOpacity style={[styles.advBtn, { backgroundColor: COLORS.green, borderColor: COLORS.green }]} disabled>
                <Text style={[styles.advBtnText, { color: '#fff', fontWeight: '700' }]}>₹{w.todayAdvance}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advBtn, { borderColor: COLORS.red, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => handleRemoveAdvance(w)}
                disabled={!!advLoading[w._id]}>
                <Text style={[styles.advBtnText, { color: COLORS.red, fontWeight: '700' }]}>✕ Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {QUICK_ADV.map(amt => (
                <TouchableOpacity key={amt}
                  style={styles.advBtn}
                  onPress={() => handleAddAdvance(w, amt)}
                  disabled={!!advLoading[w._id]}>
                  <Text style={styles.advBtnText}>₹{amt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.advBtn} onPress={() => { setShowAdvInput(w._id); setAdvAmount(''); }} disabled={!!advLoading[w._id]}>
                <Text style={styles.advBtnText}>+</Text>
              </TouchableOpacity>
            </>
          )}
          {advLoading[w._id] && <ActivityIndicator size="small" color={COLORS.amber} style={{ marginLeft: 8 }} />}
        </View>

        {(w.todayAdvance > 0 || w.todayAttendance?.travelExpense > 0) && (
          <View style={styles.todayInfo}>
            {w.todayAdvance > 0 && <Text style={styles.todayInfoText}>Advance today: ₹{w.todayAdvance}</Text>}
            {w.todayAttendance?.travelExpense > 0 && <Text style={styles.todayInfoText}>Travel: ₹{w.todayAttendance.travelExpense}</Text>}
          </View>
        )}

        {showAdvInput === w._id && (
          <View style={styles.advInputRow}>
            <TextInput style={styles.advInput} placeholder="Enter amount" keyboardType="numeric" value={advAmount} onChangeText={setAdvAmount} autoFocus />
            <TouchableOpacity style={styles.advSaveBtn} onPress={() => handleAddAdvance(w, advAmount)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAdvInput(null)} style={{ padding: 8 }}>
              <Text style={{ color: COLORS.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {showMoreAtt === w._id && (
          <View style={styles.moreAttRow}>
            {MORE_ATT.map(a => (
              <TouchableOpacity key={a.value} style={[styles.attBtn, { backgroundColor: '#E8F5E9' }]}
                onPress={() => { handleMarkAttendance(w, a.value); setShowMoreAtt(null); }}>
                <Text style={[styles.attBtnText, { color: COLORS.green }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowMoreAtt(null)} style={{ padding: 8 }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (noInternet) {
    return (
      <View style={styles.noInternetContainer}>
        <Text style={styles.noInternetIcon}>📡</Text>
        <Text style={styles.noInternetTitle}>No Internet Connection</Text>
        <Text style={styles.noInternetSub}>Please connect to the internet to continue</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.hamburger}>
          <Text style={styles.hamburgerText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {user?.role === 'admin' && viewingManager
            ? <Text style={styles.headerTitle}>{viewingManager.name}'s Workers</Text>
            : <Text style={styles.headerTitle}>Manager — {user?.name}</Text>}
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: isOnline ? COLORS.green : COLORS.red }]} />
      </View>

      {/* Admin viewing banner */}
      {user?.role === 'admin' && viewingManager && (
        <View style={styles.viewingBanner}>
          <Text style={styles.viewingBannerText}>👤 Viewing: {viewingManager.name}'s workers</Text>
          <TouchableOpacity onPress={() => { clearViewingManager(); navigation.navigate('AdminHome'); }}>
            <Text style={styles.viewingBannerBack}>← Back to Admin</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Test Mode Banner */}
      {testMode && (
        <View style={styles.testBanner}>
          <Text style={styles.testBannerText}>🧪 Test Mode — {workDate}</Text>
          <TouchableOpacity onPress={async () => {
            try {
              const res = await fillAbsent(workDate);
              Toast.show({ type: 'success', text1: res.data.message });
              fetchData(workDate);
            } catch (e) { Toast.show({ type: 'error', text1: 'Fill absent failed' }); }
          }}>
            <Text style={styles.testBannerBtn}>Fill Absent</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Undo Bar */}
      {undoLogs.length > 0 && (
        <TouchableOpacity style={styles.undoBar} onPress={() => handleUndo(undoLogs[0])}>
          <Text style={styles.undoText} numberOfLines={1}>
            {undoLogs[0].targetUser?.name}: {undoLogs[0].actionType.replace(/_/g,' ')} — Tap to Undo
          </Text>
          <Text style={styles.undoBtn}>Undo</Text>
        </TouchableOpacity>
      )}

      {/* Summary */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>Marked: {marked} / {total}</Text>
        <Text style={styles.summaryPending}>Pending: {total - marked}</Text>
      </View>

      {/* Search */}
    <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date Header */}
      <View style={styles.dateHeader}><Text style={styles.dateHeaderText}>{dateLabel}</Text></View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No workers found</Text>
          {workers.length === 0 && (
            <TouchableOpacity style={styles.addFirstBtn} onPress={() => navigation.navigate('CreateWorker')}>
              <Text style={styles.addFirstBtnText}>+ Add First Worker</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={renderWorker}
          contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        />
      )}

      {/* Worker Context Menu Modal */}
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{selectedWorker?.name}</Text>
            <Text style={styles.sheetSub}>{ROLE_LABELS[selectedWorker?.role]} · ₹{selectedWorker?.rate}/day</Text>
            {[
              { label: 'View Month History', icon: '📅', action: () => { setShowMenu(false); navigation.navigate('MonthHistory', { worker: selectedWorker }); } },
              { label: 'Edit Previous Attendance', icon: '✏️', action: () => { setShowMenu(false); navigation.navigate('MonthHistory', { worker: selectedWorker, editMode: true }); } },
              { label: selectedWorker?.isHidden ? 'Show on Home' : 'Hide from Home', icon: '👁', action: async () => {
                try { await require('../api').toggleHideWorker(selectedWorker._id); Toast.show({ type: 'success', text1: 'Done' }); setShowMenu(false); fetchData(); }
                catch { Toast.show({ type: 'error', text1: 'Failed' }); }
              }},
              ...(user?.role === 'admin' ? [{ label: 'Disable Worker', icon: '🚫', color: COLORS.red, action: handleDisable }] : []),
            ].map((item, i) => (
              <TouchableOpacity key={i} style={styles.sheetItem} onPress={item.action}>
                <Text style={styles.sheetItemIcon}>{item.icon}</Text>
                <Text style={[styles.sheetItemText, item.color && { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: COLORS.border }]} onPress={() => setShowMenu(false)}>
              <Text style={[styles.sheetItemText, { color: COLORS.textSecondary, textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingBottom: 12, paddingHorizontal: 16 },
  hamburger: { padding: 6 },
  hamburgerText: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerDate: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  testBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF3CD', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFE082' },
  viewingBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#90CAF9' },
  viewingBannerText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  viewingBannerBack: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  testBannerText: { fontSize: 13, color: '#5D4037', fontWeight: '500' },
  testBannerBtn: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  undoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#C8E6C9' },
  undoText: { flex: 1, fontSize: 13, color: '#5D4037' },
  undoBtn: { color: COLORS.primary, fontWeight: '700', fontSize: 14, marginLeft: 8 },
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryText: { color: COLORS.green, fontWeight: '600', fontSize: 14 },
  summaryPending: { color: COLORS.red, fontWeight: '600', fontSize: 14 },
  searchRow: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  searchInput: { backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  filterScroll: { backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 8, maxHeight: 48, flexShrink: 0 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.bg, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTabText: { fontSize: 14, color: COLORS.textSecondary },
  filterTabTextActive: { color: '#fff', fontWeight: '600' },
  dateHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.bg },
  dateHeaderText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  serialBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  serialText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  workerCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, marginTop: 2, padding: 12, borderWidth: 1, borderColor: COLORS.border, elevation: 1 },
  workerCardFaded: { backgroundColor: '#F7F7F7', opacity: 0.85 },
  workerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  workerName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  workerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  attBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  attBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  moreBtn: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4 },
  moreBtnText: { color: COLORS.textSecondary, fontSize: 18, letterSpacing: 1 },
  attRow: { flexDirection: 'row', marginBottom: 8 },
  attBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, marginRight: 6, minWidth: 40, alignItems: 'center' },
  attBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  moreAttRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, marginBottom: 4 },
  advRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  advLabel: { fontSize: 12, color: COLORS.textSecondary, marginRight: 6 },
  advBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, marginRight: 5, marginBottom: 4 },
  advBtnText: { fontSize: 12, color: COLORS.textPrimary },
  todayInfo: { flexDirection: 'row', gap: 12, marginTop: 6 },
  todayInfoText: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  advInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  advInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  advSaveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  noInternetContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 32 },
  noInternetIcon: { fontSize: 48, marginBottom: 16 },
  noInternetTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  noInternetSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  retryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 16 },
  addFirstBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  addFirstBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 2 },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 20, marginBottom: 14 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  sheetItemIcon: { fontSize: 20, marginRight: 14 },
  sheetItemText: { fontSize: 16, color: COLORS.textPrimary },
  alertBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, margin: 24 },
  alertTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  alertBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  alertBtnCancel: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  alertBtnCancelText: { fontSize: 15, color: COLORS.textSecondary },
  alertBtnOk: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  alertBtnOkText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 15, marginTop: 8 },
});
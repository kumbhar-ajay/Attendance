// FILE: mobile/src/screens/MonthHistory.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { getWorkerHistory, markAttendance, editAttendance, editAdvance, addAdvance, editWorkerTravel } from '../api';
import { COLORS, ATT_MAP, QUICK_ATT, MORE_ATT, ROLE_LABELS } from '../config';
import { useStore } from '../store';

const currMonth = (refDate) => { const d = refDate ? new Date(refDate + 'T12:00:00') : new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

export default function MonthHistory({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { worker, editMode } = route.params || {};
  const { testMode, testDate, user } = useStore();
  const effectiveToday = testMode && testDate ? new Date(testDate + 'T12:00:00') : new Date();
  const [month, setMonth] = useState(currMonth(testMode && testDate ? testDate : null));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAdvRow, setEditAdvRow] = useState(null);
  const [editAdvAmount, setEditAdvAmount] = useState('');
  const [showEditAdvModal, setShowEditAdvModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [showRowActionModal, setShowRowActionModal] = useState(false);
  const [editTravelRow, setEditTravelRow] = useState(null);
  const [editTravelAmount, setEditTravelAmount] = useState('');
  const [showEditTravelModal, setShowEditTravelModal] = useState(false);

  useEffect(() => { if (worker?._id) fetchHistory(); }, [month, worker, testDate]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await getWorkerHistory(worker._id, month);
      setData(res.data.data);
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed to load history' }); }
    finally { setLoading(false); }
  };

  const changeMonth = (dir) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    if (d > effectiveToday) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const handleEditAtt = async (value) => {
    if (!editRow) return;
    try {
      if (editRow._id) await editAttendance(editRow._id, value);
      else await markAttendance(worker._id, editRow.date, value);
      Toast.show({ type: 'success', text1: 'Attendance updated' });
      setShowEditModal(false); setEditRow(null); fetchHistory();
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed to update' }); }
  };

  const handleEditAdv = async () => {
    if (!editAdvRow || !editAdvAmount || Number(editAdvAmount) <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount' }); return;
    }
    try {
      if (editAdvRow._id) {
        await editAdvance(editAdvRow._id, Number(editAdvAmount));
      } else {
        await addAdvance(worker._id, Number(editAdvAmount), editAdvRow.date);
      }
      Toast.show({ type: 'success', text1: 'Advance updated' });
      setShowEditAdvModal(false); setEditAdvRow(null); fetchHistory();
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed to update advance' }); }
  };

  const handleEditTravel = async () => {
    if (!editTravelRow || editTravelAmount === '' || Number(editTravelAmount) < 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid amount (0 to clear)' }); return;
    }
    try {
      await editWorkerTravel(worker._id, editTravelRow.date, Number(editTravelAmount));
      Toast.show({ type: 'success', text1: 'Travel expense updated' });
      setShowEditTravelModal(false); setEditTravelRow(null); fetchHistory();
    } catch (e) { Toast.show({ type: 'error', text1: 'Failed to update travel' }); }
  };

  const buildDateRows = () => {
    if (!data) return [];
    const attMap = {};
    const advMap = {};
    data.attendances?.forEach(a => { attMap[a.date?.substring(0, 10)] = a; });
    data.advances?.forEach(a => {
      const ds = a.date?.substring(0, 10);
      if (!advMap[ds] || a.amount > advMap[ds].amount) advMap[ds] = a;
    });
    // Build every calendar day of the selected month
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const cutoff = testMode && testDate ? new Date(testDate + 'T23:59:59') : new Date();
    const allDates = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      // Don't show dates beyond test/real today
      if (new Date(ds + 'T00:00:00') > cutoff) break;
      allDates.push(ds);
    }
    return allDates.map(ds => ({ dateStr: ds, att: attMap[ds] || null, adv: advMap[ds] || null }));
  };

  if (!worker) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>No worker selected</Text>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ color: COLORS.primary }}>Go Back</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{worker.name}</Text>
          <Text style={styles.headerSub}>{ROLE_LABELS[worker.role]}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Summary Cards */}
          {data && (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statCard}><Text style={styles.statVal}>{data.totalDays?.toFixed(1)}</Text><Text style={styles.statLabel}>Days</Text></View>
                <View style={styles.statCard}><Text style={styles.statVal}>₹{data.totalAdvance}</Text><Text style={styles.statLabel}>Advance</Text></View>
                <View style={styles.statCard}><Text style={styles.statVal}>₹{data.totalTravel}</Text><Text style={styles.statLabel}>Travel</Text></View>
              </View>

              {/* Balance Card */}
              <View style={styles.balanceCard}>
                {user?.role !== 'manager' && (
                  <View style={styles.balRow}><Text style={styles.balLabel}>Rate</Text><Text style={styles.balVal}>₹{data.worker?.rate}/day</Text></View>
                )}
                <View style={styles.balRow}><Text style={styles.balLabel}>Earned</Text><Text style={styles.balVal}>₹{data.earned?.toFixed(0)}</Text></View>
                <View style={styles.balRow}><Text style={styles.balLabel}>Advance Paid</Text><Text style={[styles.balVal, { color: COLORS.red }]}>- ₹{data.totalAdvance}</Text></View>
                <View style={styles.balRow}><Text style={styles.balLabel}>Travel Expense</Text><Text style={[styles.balVal, { color: COLORS.green }]}>+ ₹{data.totalTravel}</Text></View>
                <View style={[styles.balRow, styles.balTotalRow]}>
                  <Text style={styles.balTotalLabel}>Balance</Text>
                  <Text style={[styles.balTotalVal, { color: data.balance >= 0 ? COLORS.green : COLORS.red }]}>₹{data.balance?.toFixed(0)}</Text>
                </View>
                {user?.role !== 'manager' && <Text style={styles.formula}>Formula: Rate × Days − Advance + Travel</Text>}
              </View>

              {/* Month Nav */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={styles.navArrow}>‹</Text></TouchableOpacity>
                <Text style={styles.monthLabel}>{new Date(month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</Text>
                <TouchableOpacity onPress={() => changeMonth(1)}><Text style={styles.navArrow}>›</Text></TouchableOpacity>
              </View>

              {/* Hint */}
              {editMode && <Text style={styles.hint}>Hold a row to edit attendance or advance</Text>}

              {/* Table */}
              <ScrollView horizontal>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHead]}>
                    {['Date','Att.','Travel','Advance','By'].map(h => (
                      <Text key={h} style={[styles.cell, styles.headCell]}>{h}</Text>
                    ))}
                  </View>
                  {data.attendances?.length === 0 && data.advances?.length === 0 && (
                    <Text style={{ padding: 16, color: COLORS.textSecondary, textAlign: 'center' }}>No records this month</Text>
                  )}
                  {buildDateRows().map(({ dateStr, att, adv }, i) => {
                    const attInfo = att ? ATT_MAP[att.value] : null;
                    const isMissing = !att && !adv;
                    const byName = att?.markedBy?.name || adv?.givenBy?.name || '—';
                    return (
                      <TouchableOpacity key={dateStr}
                        style={[styles.tableRow, i%2===0 && {backgroundColor:'#F9F9F9'}, isMissing && { opacity: 0.55 }]}
                        onLongPress={() => {
                          if (editMode) {
                            setSelectedRow({ dateStr, att, adv });
                            setShowRowActionModal(true);
                          }
                        }}>
                        <Text style={[styles.cell, { color: COLORS.textSecondary }]}>{fmtDate(dateStr)}</Text>
                        <Text style={[styles.cell, { color: isMissing ? COLORS.red : (attInfo?.color || '#ccc'), fontWeight: '700' }]}>
                          {att ? (attInfo?.display || att.value) : 'A'}
                        </Text>
                        <Text style={styles.cell}>{att?.travelExpense > 0 ? `₹${att.travelExpense}` : '—'}</Text>
                        <Text style={[styles.cell, { color: adv ? COLORS.amber : COLORS.textSecondary, fontWeight: adv ? '700' : 'normal' }]}>
                          {adv ? `₹${adv.amount}` : '—'}
                        </Text>
                        <Text style={[styles.cell, { fontSize: 11 }]}>{byName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* Totals Row */}
                  <View style={[styles.tableRow, { backgroundColor: '#EEF4FF', borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                    <Text style={[styles.cell, { fontWeight: '700' }]}>Total</Text>
                    <Text style={[styles.cell, { fontWeight: '700', color: COLORS.primary }]}>{data.totalDays?.toFixed(1)}</Text>
                    <Text style={[styles.cell, { fontWeight: '700', color: COLORS.green }]}>₹{data.totalTravel}</Text>
                    <Text style={[styles.cell, { fontWeight: '700', color: COLORS.red }]}>₹{data.totalAdvance}</Text>
                    <Text style={styles.cell} />
                  </View>
                </View>
              </ScrollView>
            </>
          )}
        </ScrollView>
      )}

      {/* Edit Attendance Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowEditModal(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Edit: {editRow ? fmtDate(editRow.date) : ''}</Text>
          <Text style={styles.sheetSub}>Current: {ATT_MAP[editRow?.value]?.display || editRow?.value || 'Not set'}</Text>
          <View style={styles.editAttRow}>
            {[...QUICK_ATT, ...MORE_ATT].map(a => (
              <TouchableOpacity key={a.value}
                style={[styles.editAttBtn, editRow?.value === a.value && { backgroundColor: ATT_MAP[a.value]?.color, borderColor: ATT_MAP[a.value]?.color }]}
                onPress={() => handleEditAtt(a.value)}>
                <Text style={[styles.editAttBtnText, editRow?.value === a.value && { color: '#fff' }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
            <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Row Action Modal — choose attendance or advance edit */}
      <Modal visible={showRowActionModal} transparent animationType="slide" onRequestClose={() => setShowRowActionModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowRowActionModal(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{selectedRow ? fmtDate(selectedRow.dateStr) : ''}</Text>
          <TouchableOpacity style={styles.actionItem} onPress={() => {
            setShowRowActionModal(false);
            setEditRow(selectedRow?.att || { date: selectedRow?.dateStr });
            setShowEditModal(true);
          }}>
            <Text style={styles.actionItemText}>
              ✏️ Edit Attendance {selectedRow?.att ? `(${ATT_MAP[selectedRow.att.value]?.display || selectedRow.att.value})` : '(not set)'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => {
            setShowRowActionModal(false);
            const adv = selectedRow?.adv;
            setEditAdvRow(adv ? { _id: adv._id, date: selectedRow.dateStr } : { date: selectedRow.dateStr });
            setEditAdvAmount(adv ? String(adv.amount) : '');
            setShowEditAdvModal(true);
          }}>
            <Text style={styles.actionItemText}>
              💵 Edit Advance {selectedRow?.adv ? `(₹${selectedRow.adv.amount})` : '(not given)'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => {
            setShowRowActionModal(false);
            const travel = selectedRow?.att?.travelExpense || 0;
            setEditTravelRow({ date: selectedRow.dateStr });
            setEditTravelAmount(travel > 0 ? String(travel) : '');
            setShowEditTravelModal(true);
          }}>
            <Text style={styles.actionItemText}>
              🚗 Edit Travel {selectedRow?.att?.travelExpense > 0 ? `(₹${selectedRow.att.travelExpense})` : '(not set)'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionItem, { borderTopWidth: 1, borderTopColor: COLORS.border }]} onPress={() => setShowRowActionModal(false)}>
            <Text style={[styles.actionItemText, { color: COLORS.textSecondary, textAlign: 'center' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Advance Modal */}
      <Modal visible={showEditAdvModal} transparent animationType="slide" onRequestClose={() => setShowEditAdvModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowEditAdvModal(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Edit Advance: {editAdvRow ? fmtDate(editAdvRow.date) : ''}</Text>
          <Text style={styles.sheetSub}>{editAdvRow?._id ? `Current: ₹${editAdvAmount}` : 'No advance on this day yet'}</Text>
          <TextInput
            style={styles.advInput}
            placeholder="Enter amount (₹)"
            keyboardType="numeric"
            value={editAdvAmount}
            onChangeText={setEditAdvAmount}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowEditAdvModal(false)}>
              <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={handleEditAdv}>
              <Text style={styles.submitBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Travel Modal */}
      <Modal visible={showEditTravelModal} transparent animationType="slide" onRequestClose={() => setShowEditTravelModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowEditTravelModal(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Edit Travel: {editTravelRow ? fmtDate(editTravelRow.date) : ''}</Text>
          <Text style={styles.sheetSub}>Enter 0 to clear travel expense for this day</Text>
          <TextInput
            style={styles.advInput}
            placeholder="Enter travel amount (₹)"
            keyboardType="numeric"
            value={editTravelAmount}
            onChangeText={setEditTravelAmount}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowEditTravelModal(false)}>
              <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { flex: 1 }]} onPress={handleEditTravel}>
              <Text style={styles.submitBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingBottom: 12, paddingHorizontal: 16 },
  backBtn: { padding: 4, marginRight: 8 },
  backBtnText: { color: '#fff', fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statVal: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  balanceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  balRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  balLabel: { fontSize: 14, color: COLORS.textSecondary },
  balVal: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  balTotalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 8 },
  balTotalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  balTotalVal: { fontSize: 18, fontWeight: '800' },
  formula: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 8 },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  navArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '600' },
  monthLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  hint: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 8, textAlign: 'center' },
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tableRow: { flexDirection: 'row', backgroundColor: '#fff' },
  tableHead: { backgroundColor: COLORS.bg },
  cell: { width: 80, paddingHorizontal: 8, paddingVertical: 10, fontSize: 12, color: COLORS.textPrimary, borderRightWidth: 0.5, borderRightColor: COLORS.border },
  headCell: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 11 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  editAttRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  editAttBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  editAttBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  cancelBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12 },
  actionItem: { paddingVertical: 14 },
  actionItemText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  advInput: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 4 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14 },
  submitBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 15 },
});
// FILE: mobile/src/screens/MonthHistory.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Modal } from 'react-native';
import Toast from 'react-native-toast-message';
import { getWorkerHistory, markAttendance, editAttendance } from '../api';
import { COLORS, ATT_MAP, QUICK_ATT, MORE_ATT, ROLE_LABELS } from '../config';

const currMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

export default function MonthHistory({ navigation, route }) {
  const { worker, editMode } = route.params || {};
  const [month, setMonth] = useState(currMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => { if (worker?._id) fetchHistory(); }, [month, worker]);

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
    if (d > new Date()) return;
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

  if (!worker) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>No worker selected</Text>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ color: COLORS.primary }}>Go Back</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
                <View style={styles.balRow}><Text style={styles.balLabel}>Rate</Text><Text style={styles.balVal}>₹{data.worker?.rate}/day</Text></View>
                <View style={styles.balRow}><Text style={styles.balLabel}>Earned</Text><Text style={styles.balVal}>₹{data.earned?.toFixed(0)}</Text></View>
                <View style={styles.balRow}><Text style={styles.balLabel}>Advance Paid</Text><Text style={[styles.balVal, { color: COLORS.red }]}>- ₹{data.totalAdvance}</Text></View>
                <View style={styles.balRow}><Text style={styles.balLabel}>Travel Expense</Text><Text style={[styles.balVal, { color: COLORS.green }]}>+ ₹{data.totalTravel}</Text></View>
                <View style={[styles.balRow, styles.balTotalRow]}>
                  <Text style={styles.balTotalLabel}>Balance</Text>
                  <Text style={[styles.balTotalVal, { color: data.balance >= 0 ? COLORS.green : COLORS.red }]}>₹{data.balance?.toFixed(0)}</Text>
                </View>
                <Text style={styles.formula}>Formula: Rate × Days − Advance + Travel</Text>
              </View>

              {/* Month Nav */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={styles.navArrow}>‹</Text></TouchableOpacity>
                <Text style={styles.monthLabel}>{new Date(month+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</Text>
                <TouchableOpacity onPress={() => changeMonth(1)}><Text style={styles.navArrow}>›</Text></TouchableOpacity>
              </View>

              {/* Hint */}
              {editMode && <Text style={styles.hint}>Hold a row to edit attendance</Text>}

              {/* Table */}
              <ScrollView horizontal>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHead]}>
                    {['Date','Att.','Travel','Advance','By'].map(h => (
                      <Text key={h} style={[styles.cell, styles.headCell]}>{h}</Text>
                    ))}
                  </View>
                  {data.attendances?.length === 0 && (
                    <Text style={{ padding: 16, color: COLORS.textSecondary, textAlign: 'center' }}>No attendance records</Text>
                  )}
                  {data.attendances?.map((att, i) => {
                    const dateStr = att.date?.substring(0, 10);
                    const dayAdv = data.advances?.filter(a => a.date?.startsWith(dateStr)).reduce((s, a) => s + a.amount, 0);
                    const attInfo = ATT_MAP[att.value];
                    return (
                      <TouchableOpacity key={i}
                        style={[styles.tableRow, i%2===0 && {backgroundColor:'#F9F9F9'}]}
                        onLongPress={() => { if (editMode) { setEditRow(att); setShowEditModal(true); } }}>
                        <Text style={[styles.cell, { color: COLORS.textSecondary }]}>{fmtDate(att.date)}</Text>
                        <Text style={[styles.cell, { color: attInfo?.color || COLORS.textPrimary, fontWeight: '700' }]}>{attInfo?.display || att.value}</Text>
                        <Text style={styles.cell}>{att.travelExpense > 0 ? `₹${att.travelExpense}` : '—'}</Text>
                        <Text style={styles.cell}>{dayAdv > 0 ? `₹${dayAdv}` : '—'}</Text>
                        <Text style={[styles.cell, { fontSize: 11 }]}>{att.markedBy?.name || '—'}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingTop: Platform.OS === 'android' ? 40 : 52, paddingBottom: 12, paddingHorizontal: 16 },
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
});
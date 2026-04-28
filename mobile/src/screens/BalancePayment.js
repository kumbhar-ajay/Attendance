// FILE: mobile/src/screens/BalancePayment.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Modal, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { getBalancePayment, getBalanceExcelUrl, getBalancePdfUrl } from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, ROLE_LABELS } from '../config';

const currMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// All available columns
const ALL_COLS = [
  { key: 'srno',    label: 'Sr.No.',  mandatory: true,  defaultOn: true },
  { key: 'name',    label: 'Name',    mandatory: true,  defaultOn: true },
  { key: 'type',    label: 'Type',    mandatory: false, defaultOn: false },
  { key: 'days',    label: 'Days',    mandatory: false, defaultOn: true },
  { key: 'rate',    label: 'Rate',    mandatory: false, defaultOn: false },
  { key: 'earned',  label: 'Earned',  mandatory: false, defaultOn: false },
  { key: 'advance', label: 'Advance', mandatory: false, defaultOn: true },
  { key: 'travel',  label: 'Travel',  mandatory: false, defaultOn: true },
  { key: 'balance', label: 'Balance', mandatory: false, defaultOn: true },
];

export default function BalancePayment({ navigation }) {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showColModal, setShowColModal] = useState(false);
  const [selectedCols, setSelectedCols] = useState(
    ALL_COLS.filter(c => c.defaultOn).map(c => c.key)
  );

  useEffect(() => { fetchBalance(); }, [month]);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const res = await getBalancePayment(month);
      // Sort rows alphabetically by name
      const sorted = [...(res.data.data.rows || [])].sort((a, b) => a.name.localeCompare(b.name));
      setData({ ...res.data.data, rows: sorted });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to load balance' });
    } finally { setLoading(false); }
  };

  const changeMonth = (dir) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    if (d > new Date()) return;
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const toggleCol = (key) => {
    if (ALL_COLS.find(c => c.key === key)?.mandatory) return;
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleDownload = async (type = 'excel') => {
    try {
      const token = await AsyncStorage.getItem('token');
      const colsParam = ALL_COLS.filter(c => selectedCols.includes(c.key)).map(c => c.key).join(',');
      const url = type === 'pdf'
        ? getBalancePdfUrl(month, colsParam, token)
        : getBalanceExcelUrl(month, colsParam, token);
      setShowColModal(false);
      await Linking.openURL(url);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to open download' });
    }
  };

  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Build visible table columns (always show all in table, Sr.No. added here)
  const sortedRows = data?.rows || [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.hamburger}>
          <Text style={styles.hamburgerText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Balance Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Month Nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : !data ? null : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{data.workerCount}</Text>
              <Text style={styles.summaryLabel}>Workers</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#1565C0' }]}>₹{data.totalEarned?.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total Earned</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: COLORS.red }]}>₹{data.totalAdvance?.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total Advance</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.summaryVal, { color: COLORS.green }]}>₹{Math.abs(data.totalBalance)?.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Net to Pay</Text>
            </View>
          </View>

          {/* Table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 16 }}>
            <View style={styles.table}>
              {/* Header */}
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.cell, styles.cellSr,  styles.headCell, styles.cellDivider]}>#</Text>
                <Text style={[styles.cell, styles.cellName, styles.headCell, styles.cellDivider]}>Name</Text>
                <Text style={[styles.cell, styles.cellType, styles.headCell, styles.cellDivider]}>Type</Text>
                <Text style={[styles.cell, styles.cellNum,  styles.headCell, styles.cellDivider]}>Days</Text>
                <Text style={[styles.cell, styles.cellNum,  styles.headCell, styles.cellDivider]}>Rate</Text>
                <Text style={[styles.cell, styles.cellNum,  styles.headCell, styles.cellDivider]}>Earned</Text>
                <Text style={[styles.cell, styles.cellNum,  styles.headCell, styles.cellDivider]}>Adv.</Text>
                <Text style={[styles.cell, styles.cellNum,  styles.headCell, styles.cellDivider]}>Travel</Text>
                <Text style={[styles.cell, styles.cellNum,  styles.headCell]}>Balance</Text>
              </View>
              {/* Data Rows */}
              {sortedRows.map((r, i) => (
                <View key={r._id || i} style={[styles.tableRow, i % 2 === 0 && { backgroundColor: '#F9F9F9' }]}>
                  <Text style={[styles.cell, styles.cellSr,  styles.cellDivider, { color: COLORS.textSecondary }]}>{i + 1}</Text>
                  <Text style={[styles.cell, styles.cellName, styles.cellDivider]} numberOfLines={2}>{r.name}</Text>
                  <Text style={[styles.cell, styles.cellType, styles.cellDivider]} numberOfLines={1}>{ROLE_LABELS[r.role] || r.role}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.cellDivider]}>{r.totalDays}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.cellDivider]}>₹{r.rate}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.cellDivider]}>₹{r.earned}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.cellDivider, { color: COLORS.red }]}>₹{r.totalAdvance}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.cellDivider, { color: COLORS.green }]}>₹{r.totalTravel}</Text>
                  <Text style={[styles.cell, styles.cellNum,  { fontWeight: '700', color: r.balance >= 0 ? COLORS.green : COLORS.red }]}>₹{r.balance?.toFixed(0)}</Text>
                </View>
              ))}
              {/* Total Row */}
              {sortedRows.length > 0 && (
                <View style={[styles.tableRow, styles.totalRow]}>
                  <Text style={[styles.cell, styles.cellSr,  styles.totalCell, styles.cellDivider]}></Text>
                  <Text style={[styles.cell, styles.cellName, styles.totalCell, styles.cellDivider]}>TOTAL</Text>
                  <Text style={[styles.cell, styles.cellType, styles.totalCell, styles.cellDivider]}></Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.totalCell, styles.cellDivider]}></Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.totalCell, styles.cellDivider]}></Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.totalCell, styles.cellDivider]}>₹{data.totalEarned?.toLocaleString()}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.totalCell, styles.cellDivider, { color: COLORS.red }]}>₹{data.totalAdvance?.toLocaleString()}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.totalCell, styles.cellDivider, { color: COLORS.green }]}>₹{data.totalTravel?.toLocaleString()}</Text>
                  <Text style={[styles.cell, styles.cellNum,  styles.totalCell, { color: COLORS.green }]}>₹{Math.abs(data.totalBalance)?.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Download Button */}
          <TouchableOpacity style={styles.downloadBtn} onPress={() => setShowColModal(true)}>
            <Text style={styles.downloadBtnText}>⬇ Download Balance Payment Table</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Column Selector Modal */}
      <Modal visible={showColModal} transparent animationType="slide" onRequestClose={() => setShowColModal(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowColModal(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Select Columns to Download</Text>
          <Text style={styles.sheetHint}>Sr.No. and Name are always included.</Text>
          {ALL_COLS.map(col => {
            const isOn = selectedCols.includes(col.key);
            return (
              <TouchableOpacity
                key={col.key}
                style={[styles.colRow, col.mandatory && styles.colRowMandatory]}
                onPress={() => toggleCol(col.key)}
                activeOpacity={col.mandatory ? 1 : 0.7}
              >
                <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                  {isOn && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.colLabel, col.mandatory && { color: COLORS.textSecondary }]}>{col.label}</Text>
                {col.mandatory && <Text style={styles.mandatoryTag}>mandatory</Text>}
              </TouchableOpacity>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setShowColModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={() => handleDownload('excel')}>
              <Text style={styles.confirmBtnText}>📊 Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.pdfBtn]} onPress={() => handleDownload('pdf')}>
              <Text style={styles.confirmBtnText}>📄 PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary,

    paddingBottom: 14, paddingHorizontal: 16,
  },
  hamburger: { padding: 6, width: 40 },
  hamburgerText: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '700' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: 20 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, elevation: 1 },
  summaryVal: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  // Table
  table: { borderWidth: 1.5, borderColor: '#B0BEC5', borderRadius: 10, overflow: 'hidden', elevation: 2 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CFD8DC' },
  tableHead: { backgroundColor: COLORS.primary },
  totalRow: { backgroundColor: '#E3F2FD', borderTopWidth: 2, borderTopColor: '#90CAF9' },
  cell: { paddingVertical: 10, paddingHorizontal: 6, fontSize: 12, color: COLORS.textPrimary, textAlign: 'center' },
  cellDivider: { borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.10)' },
  cellSr:   { width: 36, textAlign: 'center' },
  cellName: { width: 110, textAlign: 'left', paddingLeft: 8 },
  cellType: { width: 72, textAlign: 'center' },
  cellNum:  { width: 72, textAlign: 'right', paddingRight: 8 },
  headCell: { color: '#fff', fontWeight: '700', fontSize: 12 },
  totalCell: { fontWeight: '700', color: COLORS.textPrimary },
  // Download
  downloadBtn: {
    marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 10,
    padding: 14, alignItems: 'center', elevation: 2,
  },
  downloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  sheetHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 },
  colRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  colRowMandatory: { opacity: 0.6 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: COLORS.primary, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxOn: { backgroundColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  colLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  mandatoryTag: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic' },
  actionBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  cancelBtn: { borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  confirmBtn: { backgroundColor: COLORS.primary },
  pdfBtn: { backgroundColor: '#C62828' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});


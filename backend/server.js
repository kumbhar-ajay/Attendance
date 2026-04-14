// FILE: backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const cors = require('cors');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const cloudinary = require('cloudinary').v2;
const { User, Attendance, Advance, ActionLog } = require('./models');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─────────────── MIDDLEWARE ───────────────
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const role = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Access denied' });
  next();
};

// ─────────────── HELPERS ───────────────
const getToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

const calcMonthStats = async (workerId, start, end) => {
  const attendances = await Attendance.find({ workerId, date: { $gte: start, $lt: end } }).populate('markedBy','name');
  const advances = await Advance.find({ workerId, date: { $gte: start, $lt: end } }).populate('givenBy','name');
  const totalDays = attendances.reduce((s, a) => s + parseFloat(a.value || 0), 0);
  const totalAdvance = advances.reduce((s, a) => s + a.amount, 0);
  const totalTravel = attendances.reduce((s, a) => s + (a.travelExpense || 0), 0);
  return { attendances, advances, totalDays, totalAdvance, totalTravel };
};

// ─────────────── AUTH ROUTES ───────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ success: false, message: 'Mobile and password required' });
    const user = await User.findOne({ mobile: mobile.trim() });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.status === 'disabled') return res.status(403).json({ success: false, message: 'Account has been disabled' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    res.json({
      success: true, token, refreshToken,
      user: { _id: user._id, name: user.name, role: user.role, photoUrl: user.photoUrl, mobile: user.mobile, rate: user.rate }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const token = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch { res.status(401).json({ success: false, message: 'Invalid refresh token' }); }
});

app.put('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── UPLOAD ───────────────
app.post('/api/upload/photo', auth, async (req, res) => {
  try {
    const { image } = req.body;
    const result = await cloudinary.uploader.upload(image, { folder: 'attendance-app', resource_type: 'image' });
    res.json({ success: true, url: result.secure_url });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ADMIN ROUTES ───────────────
app.get('/api/admin/managers', auth, role('admin'), async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('-passwordHash');
    const result = await Promise.all(managers.map(async m => {
      const workerCount = await User.countDocuments({ createdBy: m._id, role: { $in: ['labour','mistry','half_mistry'] } });
      return { ...m.toObject(), workerCount };
    }));
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/admin/managers', auth, role('admin'), async (req, res) => {
  try {
    const { name, mobile, photoUrl } = req.body;
    if (!name || !mobile) return res.status(400).json({ success: false, message: 'Name and mobile are required' });
    const existing = await User.findOne({ mobile });
    if (existing) return res.status(400).json({ success: false, message: 'Mobile number already registered' });
    const passwordHash = await bcrypt.hash(mobile, 10);
    const manager = await User.create({ name, mobile, role: 'manager', passwordHash, photoUrl, createdBy: req.user._id, status: 'active' });
    res.json({ success: true, data: { ...manager.toObject(), passwordHash: undefined } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/admin/users/:id/password', auth, role('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const passwordHash = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(req.params.id, { passwordHash });
    res.json({ success: true, message: 'Password updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/admin/users/:id/rate', auth, role('admin'), async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || rate <= 0) return res.status(400).json({ success: false, message: 'Valid rate required' });
    await User.findByIdAndUpdate(req.params.id, { rate });
    res.json({ success: true, message: 'Rate updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── REPORT ROUTES ───────────────
const buildReport = async (query, month) => {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  const workers = await User.find(query).select('-passwordHash');
  return Promise.all(workers.map(async w => {
    const { totalDays, totalAdvance, totalTravel } = await calcMonthStats(w._id, start, end);
    const earned = w.rate * totalDays;
    const balance = earned - totalAdvance + totalTravel;
    return { name: w.name, role: w.role, rate: w.rate, totalDays, earned, totalAdvance, totalTravel, balance };
  }));
};

app.get('/api/report', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required as YYYY-MM' });
    let query = { role: { $in: ['labour','mistry','half_mistry','manager'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const data = await buildReport(query, month);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/report/excel', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { month } = req.query;
    let query = { role: { $in: ['labour','mistry','half_mistry','manager'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const rows = await buildReport(query, month);
    const headers = ['Name','Role','Rate','Total Days','Earned','Advance','Travel','Balance'];
    const data = [headers, ...rows.map(r => [r.name, r.role, r.rate, r.totalDays, r.earned, r.totalAdvance, r.totalTravel, r.balance])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename=report-${month}.xlsx` });
    res.send(buf);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/report/pdf', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { month } = req.query;
    let query = { role: { $in: ['labour','mistry','half_mistry','manager'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const rows = await buildReport(query, month);
    const doc = new PDFDocument({ margin: 40 });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=report-${month}.pdf` });
    doc.pipe(res);
    doc.fontSize(16).text(`Attendance Report - ${month}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    const cols = ['Name','Role','Rate','Days','Earned','Advance','Travel','Balance'];
    const widths = [90,70,50,40,60,60,50,60];
    let x = 40, y = doc.y;
    cols.forEach((c,i) => { doc.text(c, x, y, { width: widths[i], underline: true }); x += widths[i]; });
    doc.moveDown(0.5);
    rows.forEach(r => {
      const vals = [r.name, r.role, r.rate, r.totalDays, r.earned, r.totalAdvance, r.totalTravel, r.balance];
      x = 40; y = doc.y;
      vals.forEach((v,i) => { doc.text(String(v), x, y, { width: widths[i] }); x += widths[i]; });
      doc.moveDown(0.5);
    });
    doc.end();
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── WORKER ROUTES (ORDER MATTERS — specific before :id) ───────────────
app.get('/api/workers/inactive', auth, role('admin','manager'), async (req, res) => {
  try {
    let query = { role: { $in: ['labour','mistry','half_mistry'] }, status: { $in: ['disabled','long_leave'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const workers = await User.find(query).select('-passwordHash');
    res.json({ success: true, data: workers });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/workers', auth, role('admin','manager'), async (req, res) => {
  try {
    let query = { role: { $in: ['labour','mistry','half_mistry'] }, status: 'active' };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const workers = await User.find(query).select('-passwordHash');
    const order = { mistry: 0, labour: 1, half_mistry: 2 };
    workers.sort((a, b) => order[a.role] !== order[b.role] ? order[a.role] - order[b.role] : a.name.localeCompare(b.name));
    res.json({ success: true, data: workers });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/workers', auth, role('admin','manager'), async (req, res) => {
  try {
    const { name, mobile, role: workerRole, rate, photoUrl } = req.body;
    if (!name || !mobile || !workerRole || !rate) return res.status(400).json({ success: false, message: 'All fields required' });
    if (mobile.length !== 10) return res.status(400).json({ success: false, message: 'Mobile must be 10 digits' });
    const existing = await User.findOne({ mobile });
    if (existing) return res.status(400).json({ success: false, message: 'Mobile already registered' });
    const passwordHash = await bcrypt.hash(mobile, 10);
    const worker = await User.create({ name, mobile, role: workerRole, rate: Number(rate), photoUrl, passwordHash, createdBy: req.user._id, status: 'active' });
    res.json({ success: true, data: { ...worker.toObject(), passwordHash: undefined } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/workers/:id/status', auth, role('admin','manager'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    const prev = await User.findById(req.params.id);
    if (!prev) return res.status(404).json({ success: false, message: 'Worker not found' });
    await User.findByIdAndUpdate(req.params.id, { status, longLeaveReason: reason || '' });
    await ActionLog.create({ performedBy: req.user._id, actionType: 'status_change', targetUser: req.params.id, previousValue: prev.status, newValue: status, date: new Date() });
    res.json({ success: true, message: 'Status updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/workers/:id/toggle-hidden', auth, role('admin','manager'), async (req, res) => {
  try {
    const worker = await User.findById(req.params.id);
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
    await User.findByIdAndUpdate(req.params.id, { isHidden: !worker.isHidden });
    res.json({ success: true, isHidden: !worker.isHidden });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/workers/:id/history', auth, role('admin','manager'), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required' });
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1), end = new Date(year, m, 1);
    const worker = await User.findById(req.params.id).select('-passwordHash');
    const { attendances, advances, totalDays, totalAdvance, totalTravel } = await calcMonthStats(req.params.id, start, end);
    const earned = worker.rate * totalDays;
    const balance = earned - totalAdvance + totalTravel;
    res.json({ success: true, data: { worker, attendances, advances, totalDays, totalAdvance, totalTravel, earned, balance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ATTENDANCE ROUTES ───────────────
app.get('/api/attendance/today', auth, role('admin','manager'), async (req, res) => {
  try {
    const today = getToday();
    let workerQuery = { role: { $in: ['labour','mistry','half_mistry'] }, status: 'active' };
    if (req.user.role === 'manager') workerQuery.createdBy = req.user._id;
    const workers = await User.find(workerQuery).select('-passwordHash');
    const ids = workers.map(w => w._id);
    const atts = await Attendance.find({ workerId: { $in: ids }, date: today });
    const advs = await Advance.find({ workerId: { $in: ids }, date: { $gte: today, $lt: new Date(today.getTime() + 86400000) } });
    const attMap = {}, advMap = {};
    atts.forEach(a => { attMap[a.workerId.toString()] = a; });
    advs.forEach(a => { const id = a.workerId.toString(); advMap[id] = (advMap[id] || 0) + a.amount; });
    const result = workers.map(w => ({ ...w.toObject(), todayAttendance: attMap[w._id.toString()] || null, todayAdvance: advMap[w._id.toString()] || 0 }));
    const order = { mistry: 0, labour: 1, half_mistry: 2 };
    result.sort((a, b) => order[a.role] !== order[b.role] ? order[a.role] - order[b.role] : a.name.localeCompare(b.name));
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/attendance/travel', auth, async (req, res) => {
  try {
    const { date, amount } = req.body;
    const attDate = new Date(date); attDate.setHours(0,0,0,0);
    let att = await Attendance.findOne({ workerId: req.user._id, date: attDate });
    if (!att) att = await Attendance.create({ workerId: req.user._id, date: attDate, value: '0', travelExpense: Number(amount) });
    else { att.travelExpense = Number(amount); await att.save(); }
    res.json({ success: true, data: att });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/attendance/me', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1), end = new Date(year, m, 1);
    const attendances = await Attendance.find({ workerId: req.user._id, date: { $gte: start, $lt: end } }).sort({ date: 1 });
    const advances = await Advance.find({ workerId: req.user._id, date: { $gte: start, $lt: end } }).sort({ date: 1 });
    const worker = await User.findById(req.user._id).select('-passwordHash');
    const totalDays = attendances.reduce((s, a) => s + parseFloat(a.value || 0), 0);
    const totalAdvance = advances.reduce((s, a) => s + a.amount, 0);
    const totalTravel = attendances.reduce((s, a) => s + (a.travelExpense || 0), 0);
    const earned = worker.rate * totalDays;
    const balance = earned - totalAdvance + totalTravel;
    res.json({ success: true, data: { attendances, advances, worker, totalDays, totalAdvance, totalTravel, earned, balance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/attendance/streak/:workerId', auth, role('admin','manager'), async (req, res) => {
  try {
    const end = getToday();
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const atts = await Attendance.find({ workerId: req.params.workerId, date: { $gte: start, $lte: end } }).sort({ date: 1 });
    res.json({ success: true, data: atts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/attendance', auth, role('admin','manager'), async (req, res) => {
  try {
    const { workerId, date, value } = req.body;
    const attDate = new Date(date); attDate.setHours(0,0,0,0);
    let existing = await Attendance.findOne({ workerId, date: attDate });
    const prevValue = existing ? existing.value : null;
    let attId;
    if (existing) { existing.value = value; existing.markedBy = req.user._id; await existing.save(); attId = existing._id; }
    else { const att = await Attendance.create({ workerId, date: attDate, value, markedBy: req.user._id }); attId = att._id; }
    const logEntry = await ActionLog.create({ performedBy: req.user._id, actionType: 'mark_attendance', targetUser: workerId, previousValue: prevValue, newValue: attId.toString(), date: attDate });
    res.json({ success: true, data: { attId, logId: logEntry._id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/attendance/:id', auth, role('admin','manager'), async (req, res) => {
  try {
    const { value } = req.body;
    const att = await Attendance.findById(req.params.id);
    if (!att) return res.status(404).json({ success: false, message: 'Record not found' });
    const prev = att.value;
    att.value = value; att.markedBy = req.user._id; await att.save();
    await ActionLog.create({ performedBy: req.user._id, actionType: 'edit_attendance', targetUser: att.workerId, previousValue: prev, newValue: value, date: att.date });
    res.json({ success: true, data: att });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ADVANCE ROUTES ───────────────
app.post('/api/advance', auth, role('admin','manager'), async (req, res) => {
  try {
    const { workerId, amount, date, note } = req.body;
    if (!workerId || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid worker and amount required' });
    const advance = await Advance.create({ workerId, amount: Number(amount), date: date ? new Date(date) : new Date(), givenBy: req.user._id, note: note || '' });
    const logEntry = await ActionLog.create({ performedBy: req.user._id, actionType: 'add_advance', targetUser: workerId, previousValue: null, newValue: advance._id.toString(), date: new Date() });
    res.json({ success: true, data: { ...advance.toObject(), logId: logEntry._id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/advance/:id', auth, role('admin','manager'), async (req, res) => {
  try {
    const advance = await Advance.findByIdAndDelete(req.params.id);
    if (!advance) return res.status(404).json({ success: false, message: 'Advance not found' });
    await ActionLog.create({ performedBy: req.user._id, actionType: 'remove_advance', targetUser: advance.workerId, previousValue: advance.amount, newValue: null, date: new Date() });
    res.json({ success: true, message: 'Advance removed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ACTION LOG / UNDO ───────────────
app.get('/api/actions/log', auth, role('admin','manager'), async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const logs = await ActionLog.find({ performedBy: req.user._id, createdAt: { $gte: since } })
      .populate('targetUser', 'name').sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: logs });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/actions/undo', auth, role('admin','manager'), async (req, res) => {
  try {
    const { actionId } = req.body;
    const log = await ActionLog.findById(actionId).populate('targetUser','name');
    if (!log) return res.status(404).json({ success: false, message: 'Action not found' });
    const since = new Date(Date.now() - 30 * 60 * 1000);
    if (log.createdAt < since) return res.status(400).json({ success: false, message: 'Undo window has expired (30 min)' });

    if (log.actionType === 'mark_attendance') {
      if (log.previousValue === null) await Attendance.findByIdAndDelete(log.newValue);
      else await Attendance.findByIdAndUpdate(log.newValue, { value: log.previousValue });
    } else if (log.actionType === 'add_advance') {
      await Advance.findByIdAndDelete(log.newValue);
    } else if (log.actionType === 'status_change') {
      await User.findByIdAndUpdate(log.targetUser, { status: log.previousValue });
    }

    await ActionLog.findByIdAndDelete(actionId);
    res.json({ success: true, message: 'Action undone successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── CRON — AUTO ABSENT 23:59 IST (18:29 UTC) ───────────────
cron.schedule('29 18 * * *', async () => {
  console.log('[CRON] Running auto-absent job...');
  try {
    const today = getToday();
    const workers = await User.find({ status: 'active', role: { $ne: 'admin' } });
    let count = 0;
    for (const w of workers) {
      const exists = await Attendance.findOne({ workerId: w._id, date: today });
      if (!exists) { await Attendance.create({ workerId: w._id, date: today, value: '0', markedBy: null }); count++; }
    }
    console.log(`[CRON] Auto-absent applied to ${count} workers`);
  } catch (e) { console.error('[CRON] Error:', e.message); }
}, { timezone: 'UTC' });

// ─────────────── SEED + START ───────────────
async function seedAdmin() {
  try {
    const exists = await User.findOne({ mobile: process.env.ADMIN_MOBILE });
    if (!exists) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await User.create({ name: 'Admin', mobile: process.env.ADMIN_MOBILE, role: 'admin', passwordHash, status: 'active' });
      console.log('[SEED] Admin user created:', process.env.ADMIN_MOBILE);
    } else { console.log('[SEED] Admin already exists'); }
  } catch (e) { console.error('[SEED] Error:', e.message); }
}

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('[DB] MongoDB connected');
    await seedAdmin();
    app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
      console.log(`[SERVER] Running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(e => { console.error('[DB] Connection failed:', e.message); process.exit(1); });
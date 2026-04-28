// FILE: backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express     = require('express');
const mongoose    = require('mongoose');
const jwt         = require('jsonwebtoken');
const cron        = require('node-cron');
const cors        = require('cors');
const XLSX        = require('xlsx');
const PDFDocument = require('pdfkit');
const cloudinary  = require('cloudinary').v2;
const { User, Attendance, Advance, ActionLog } = require('./models');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─────────────── HELPERS ───────────────
const stripPw = (u) => { if (!u) return u; const { password, ...rest } = u; return rest; };
const getToday = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const toUTCDay = (dateStr) => new Date(dateStr + 'T00:00:00.000Z');

// ─────────────── MIDDLEWARE ───────────────
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).lean();
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = stripPw(user);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const role = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Access denied' });
  next();
};

// ─────────────── CALC MONTH STATS ───────────────
const calcMonthStats = async (workerId, start, end) => {
  const rawAtts = await Attendance.find({ workerId, date: { $gte: start, $lt: end } }).lean();
  const rawAdvs = await Advance.find({ workerId, date: { $gte: start, $lt: end } }).lean();

  const attendances = await Promise.all(rawAtts.map(async a => {
    const marker = a.markedBy ? await User.findById(a.markedBy).lean() : null;
    return { ...a, markedBy: marker ? { _id: marker._id, name: marker.name } : null };
  }));
  const advances = await Promise.all(rawAdvs.map(async a => {
    const giver = a.givenBy ? await User.findById(a.givenBy).lean() : null;
    return { ...a, givenBy: giver ? { _id: giver._id, name: giver.name } : null };
  }));

  const totalDays    = rawAtts.reduce((s, a) => s + parseFloat(a.value || 0), 0);
  const totalAdvance = rawAdvs.reduce((s, a) => s + a.amount, 0);
  const totalTravel  = rawAtts.reduce((s, a) => s + (a.travelExpense || 0), 0);
  return { attendances, advances, totalDays, totalAdvance, totalTravel };
};

// ─────────────── AUTH ROUTES ───────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ success: false, message: 'Mobile and password required' });
    const user = await User.findOne({ mobile: mobile.trim() }).lean();
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.password !== password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.status === 'disabled') return res.status(403).json({ success: false, message: 'Account has been disabled' });
    const token        = jwt.sign({ id: user._id }, process.env.JWT_SECRET,         { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
    res.json({
      success: true, token, refreshToken,
      user: { _id: user._id, name: user.name, role: user.role, photoUrl: user.photoUrl, mobile: user.mobile, rate: user.rate },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const token   = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch { res.status(401).json({ success: false, message: 'Invalid refresh token' }); }
});

app.put('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).lean();
    if (user.password !== currentPassword) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    await User.findByIdAndUpdate(req.user._id, { $set: { password: newPassword } });
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
    const managers = await User.find({ role: 'manager' }).lean();
    const result = await Promise.all(managers.map(async m => {
      const workerCount = await User.countDocuments({ createdBy: m._id, role: { $in: ['labour', 'mistry', 'half_mistry'] } });
      return { ...stripPw(m), workerCount };
    }));
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/admin/managers', auth, role('admin'), async (req, res) => {
  try {
    const { name, mobile, photoUrl, rate } = req.body;
    if (!name || !mobile) return res.status(400).json({ success: false, message: 'Name and mobile are required' });
    if (mobile.length !== 10) return res.status(400).json({ success: false, message: 'Mobile must be 10 digits' });
    const existing = await User.findOne({ mobile }).lean();
    if (existing) return res.status(400).json({ success: false, message: 'Mobile number already registered' });
    const manager = await User.create({ name, mobile, role: 'manager', password: mobile, photoUrl: photoUrl || null, createdBy: req.user._id, status: 'active', rate: Number(rate) || 0 });
    res.json({ success: true, data: stripPw(manager.toObject()) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/admin/users/:id/password', auth, role('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    await User.findByIdAndUpdate(req.params.id, { $set: { password } });
    res.json({ success: true, message: 'Password updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/admin/users/:id/rate', auth, role('admin'), async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || rate <= 0) return res.status(400).json({ success: false, message: 'Valid rate required' });
    await User.findByIdAndUpdate(req.params.id, { $set: { rate } });
    res.json({ success: true, message: 'Rate updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/admin/managers/:id', auth, role('admin'), async (req, res) => {
  try {
    const manager = await User.findById(req.params.id).lean();
    if (!manager || manager.role !== 'manager') return res.status(404).json({ success: false, message: 'Manager not found' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Manager removed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── REPORT ROUTES ───────────────
const buildReport = async (query, month) => {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(year, m - 1, 1);
  const end   = new Date(year, m, 1);
  const workers = await User.find({ ...query, status: { $ne: 'disabled' } }).lean();
  return Promise.all(workers.map(async w => {
    const { totalDays, totalAdvance, totalTravel } = await calcMonthStats(w._id, start, end);
    const earned  = w.rate * totalDays;
    const balance = earned - totalAdvance + totalTravel;
    return { _id: w._id, name: w.name, role: w.role, rate: w.rate, totalDays, earned, totalAdvance, totalTravel, balance };
  }));
};

app.get('/api/report', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required as YYYY-MM' });
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const data = await buildReport(query, month);
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/report/balance', auth, role('admin'), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required' });
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end   = new Date(year, m, 1);
    const workers = await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] }, status: { $in: ['active', 'disabled'] } }).lean();
    const rows = await Promise.all(workers.map(async w => {
      const { totalDays, totalAdvance, totalTravel } = await calcMonthStats(w._id, start, end);
      const earned  = w.rate * totalDays;
      const balance = earned - totalAdvance + totalTravel;
      return { _id: w._id, name: w.name, role: w.role, rate: w.rate, totalDays, earned, totalAdvance, totalTravel, balance, status: w.status };
    }));
    const totals = rows.reduce((acc, r) => ({
      totalEarned:  acc.totalEarned  + r.earned,
      totalAdvance: acc.totalAdvance + r.totalAdvance,
      totalTravel:  acc.totalTravel  + r.totalTravel,
      totalBalance: acc.totalBalance + r.balance,
    }), { totalEarned: 0, totalAdvance: 0, totalTravel: 0, totalBalance: 0 });
    res.json({ success: true, data: { rows, ...totals, workerCount: rows.length } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/report/balance-pdf', auth, role('admin'), async (req, res) => {
  try {
    const { month, columns } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required' });
    const selectedCols = columns ? columns.split(',') : ['srno','name','days','advance','travel','balance'];
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1), end = new Date(year, m, 1);
    const workers = await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] }, status: { $in: ['active', 'disabled'] } }).lean();
    const rows = await Promise.all(workers.map(async w => {
      const { totalDays, totalAdvance, totalTravel } = await calcMonthStats(w._id, start, end);
      const earned  = w.rate * totalDays;
      const balance = earned - totalAdvance + totalTravel;
      return { name: w.name, role: w.role, rate: w.rate, totalDays, earned, totalAdvance, totalTravel, balance };
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const colDefs = [
      { key: 'srno',    label: 'Sr.No.',  width: 40 },
      { key: 'name',    label: 'Name',    width: 110 },
      { key: 'type',    label: 'Type',    width: 80 },
      { key: 'days',    label: 'Days',    width: 40 },
      { key: 'rate',    label: 'Rate',    width: 55 },
      { key: 'earned',  label: 'Earned',  width: 65 },
      { key: 'advance', label: 'Advance', width: 65 },
      { key: 'travel',  label: 'Travel',  width: 55 },
      { key: 'balance', label: 'Balance', width: 65 },
    ].filter(c => selectedCols.includes(c.key));

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=balance-${month}.pdf` });
    doc.pipe(res);

    const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    doc.fontSize(14).font('Helvetica-Bold').text(`Balance Payment - ${monthLabel}`, { align: 'center' });
    doc.moveDown(0.6);

    doc.fontSize(9).font('Helvetica-Bold');
    let x = 36, y = doc.y;
    colDefs.forEach(c => {
      doc.rect(x, y, c.width, 16).fill('#1565C0');
      doc.fillColor('#ffffff').text(c.label, x + 2, y + 3, { width: c.width - 4, align: 'center' });
      x += c.width;
    });
    doc.fillColor('#000000');
    y += 16;

    doc.fontSize(8).font('Helvetica');
    const totals = { earned: 0, advance: 0, travel: 0, balance: 0 };
    rows.forEach((r, i) => {
      x = 36;
      const rowH = 15;
      const bg = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
      colDefs.forEach(c => {
        doc.rect(x, y, c.width, rowH).fill(bg).stroke('#CCCCCC');
        let val = '';
        if (c.key === 'srno')    val = String(i + 1);
        else if (c.key === 'name')    val = r.name;
        else if (c.key === 'type')    val = r.role;
        else if (c.key === 'days')    val = String(r.totalDays);
        else if (c.key === 'rate')    val = String(r.rate);
        else if (c.key === 'earned')  { val = `Rs.${r.earned}`;           totals.earned  += r.earned; }
        else if (c.key === 'advance') { val = `Rs.${r.totalAdvance}`;     totals.advance += r.totalAdvance; }
        else if (c.key === 'travel')  { val = `Rs.${r.totalTravel}`;      totals.travel  += r.totalTravel; }
        else if (c.key === 'balance') { val = `Rs.${Number(r.balance.toFixed(0))}`; totals.balance += r.balance; }
        doc.fillColor('#000000').text(val, x + 2, y + 3, { width: c.width - 4, align: c.key === 'name' ? 'left' : 'center', lineBreak: false });
        x += c.width;
      });
      y += rowH;
      if (y > 770) { doc.addPage(); y = 36; }
    });

    x = 36;
    colDefs.forEach(c => {
      doc.rect(x, y, c.width, 16).fill('#BBDEFB').stroke('#90CAF9');
      let val = '';
      if (c.key === 'name')    val = 'TOTAL';
      else if (c.key === 'earned')  val = `Rs.${totals.earned}`;
      else if (c.key === 'advance') val = `Rs.${totals.advance}`;
      else if (c.key === 'travel')  val = `Rs.${totals.travel}`;
      else if (c.key === 'balance') val = `Rs.${Number(totals.balance.toFixed(0))}`;
      doc.fillColor('#000000').font('Helvetica-Bold').text(val, x + 2, y + 3, { width: c.width - 4, align: 'center', lineBreak: false });
      x += c.width;
    });

    doc.end();
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/report/balance-excel', auth, role('admin'), async (req, res) => {
  try {
    const { month, columns } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required' });
    const selectedCols = columns ? columns.split(',') : ['srno','name','days','advance','travel','balance'];
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1), end = new Date(year, m, 1);
    const workers = await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] }, status: { $in: ['active', 'disabled'] } }).lean();
    const rows = await Promise.all(workers.map(async w => {
      const { totalDays, totalAdvance, totalTravel } = await calcMonthStats(w._id, start, end);
      const earned  = w.rate * totalDays;
      const balance = earned - totalAdvance + totalTravel;
      return { name: w.name, role: w.role, rate: w.rate, totalDays, earned, totalAdvance, totalTravel, balance };
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const colDefs = [
      { key: 'srno',    label: 'Sr.No.' },
      { key: 'name',    label: 'Name' },
      { key: 'type',    label: 'Type' },
      { key: 'days',    label: 'Days' },
      { key: 'rate',    label: 'Rate' },
      { key: 'earned',  label: 'Earned' },
      { key: 'advance', label: 'Advance' },
      { key: 'travel',  label: 'Travel' },
      { key: 'balance', label: 'Balance' },
    ].filter(c => selectedCols.includes(c.key));

    const header   = colDefs.map(c => c.label);
    const dataRows = rows.map((r, i) => colDefs.map(c => {
      if (c.key === 'srno')    return i + 1;
      if (c.key === 'name')    return r.name;
      if (c.key === 'type')    return r.role;
      if (c.key === 'days')    return r.totalDays;
      if (c.key === 'rate')    return r.rate;
      if (c.key === 'earned')  return r.earned;
      if (c.key === 'advance') return r.totalAdvance;
      if (c.key === 'travel')  return r.totalTravel;
      if (c.key === 'balance') return Number(r.balance.toFixed(0));
      return '';
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...dataRows]), 'Balance');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=balance-${month}.xlsx`,
    });
    res.send(buf);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/report/excel', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { month } = req.query;
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const rows = await buildReport(query, month);
    const headers = ['Name', 'Role', 'Rate', 'Total Days', 'Earned', 'Advance', 'Travel', 'Balance'];
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
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] } };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const rows = await buildReport(query, month);
    const doc = new PDFDocument({ margin: 40 });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=report-${month}.pdf` });
    doc.pipe(res);
    doc.fontSize(16).text(`Attendance Report - ${month}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    const cols   = ['Name', 'Role', 'Rate', 'Days', 'Earned', 'Advance', 'Travel', 'Balance'];
    const widths = [90, 70, 50, 40, 60, 60, 50, 60];
    let x = 40, y = doc.y;
    cols.forEach((c, i) => { doc.text(c, x, y, { width: widths[i], underline: true }); x += widths[i]; });
    doc.moveDown(0.5);
    rows.forEach(r => {
      const vals = [r.name, r.role, r.rate, r.totalDays, r.earned, r.totalAdvance, r.totalTravel, r.balance];
      x = 40; y = doc.y;
      vals.forEach((v, i) => { doc.text(String(v), x, y, { width: widths[i] }); x += widths[i]; });
      doc.moveDown(0.5);
    });
    doc.end();
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── WORKER ROUTES (specific before :id) ───────────────
app.get('/api/workers/inactive', auth, role('admin', 'manager'), async (req, res) => {
  try {
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry'] }, status: 'long_leave' };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const workers = await User.find(query).lean();
    res.json({ success: true, data: workers.map(stripPw) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/workers/disabled', auth, role('admin', 'manager'), async (req, res) => {
  try {
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry'] }, status: 'disabled' };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const workers = await User.find(query).lean();
    res.json({ success: true, data: workers.map(stripPw) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/workers/hidden', auth, role('admin', 'manager'), async (req, res) => {
  try {
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry'] }, status: 'active', isHidden: true };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const workers = await User.find(query).lean();
    res.json({ success: true, data: workers.map(stripPw) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/workers', auth, role('admin', 'manager'), async (req, res) => {
  try {
    let query = { role: { $in: ['labour', 'mistry', 'half_mistry'] }, status: 'active' };
    if (req.user.role === 'manager') query.createdBy = req.user._id;
    const workers = (await User.find(query).lean()).map(stripPw);
    const order = { mistry: 0, labour: 1, half_mistry: 2 };
    workers.sort((a, b) => order[a.role] !== order[b.role] ? order[a.role] - order[b.role] : a.name.localeCompare(b.name));
    res.json({ success: true, data: workers });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/workers', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { name, mobile, role: workerRole, rate, photoUrl, forManagerId } = req.body;
    if (!name || !mobile || !workerRole || !rate) return res.status(400).json({ success: false, message: 'All fields required' });
    if (mobile.length !== 10) return res.status(400).json({ success: false, message: 'Mobile must be 10 digits' });
    const existing = await User.findOne({ mobile }).lean();
    if (existing) return res.status(400).json({ success: false, message: 'Mobile already registered' });
    const createdBy = (req.user.role === 'admin' && forManagerId) ? forManagerId : req.user._id;
    const worker = await User.create({ name, mobile, role: workerRole, rate: Number(rate), photoUrl: photoUrl || null, password: mobile, createdBy, status: 'active' });
    res.json({ success: true, data: stripPw(worker.toObject()) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/workers/:id/status', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    const prev = await User.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ success: false, message: 'Worker not found' });
    const updates = { status, longLeaveReason: reason || '' };
    if (status === 'disabled') updates.disabledAt = new Date().toISOString();
    await User.findByIdAndUpdate(req.params.id, { $set: updates });
    await ActionLog.create({ performedBy: req.user._id, actionType: 'status_change', targetUser: req.params.id, previousValue: prev.status, newValue: status, date: new Date() });
    res.json({ success: true, message: 'Status updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/workers/:id/toggle-hidden', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const worker = await User.findById(req.params.id).lean();
    if (!worker) return res.status(404).json({ success: false, message: 'Worker not found' });
    await User.findByIdAndUpdate(req.params.id, { $set: { isHidden: !worker.isHidden } });
    res.json({ success: true, isHidden: !worker.isHidden });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/workers/:id/history', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month required' });
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1), end = new Date(year, m, 1);
    const worker = stripPw(await User.findById(req.params.id).lean());
    const { attendances, advances, totalDays, totalAdvance, totalTravel } = await calcMonthStats(req.params.id, start, end);
    const earned  = worker.rate * totalDays;
    const balance = earned - totalAdvance + totalTravel;
    res.json({ success: true, data: { worker, attendances, advances, totalDays, totalAdvance, totalTravel, earned, balance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ATTENDANCE ROUTES ───────────────
app.get('/api/attendance/today', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const qDate    = req.query.date ? toUTCDay(req.query.date) : getToday();
    const qDateEnd = new Date(qDate.getTime() + 86400000);
    let workers;
    // All managers see all workers (not just their own)
    if (req.user.role === 'manager') {
      workers = (await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] }, status: 'active' }).lean()).map(stripPw);
    } else if (req.query.managerId) {
      const mgrId = req.query.managerId;
      const subordinates = await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry'] }, status: 'active', createdBy: mgrId }).lean();
      const mgr = await User.findById(mgrId).lean();
      workers = (mgr ? [mgr, ...subordinates] : subordinates).map(stripPw);
    } else {
      workers = (await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry', 'manager'] }, status: 'active' }).lean()).map(stripPw);
    }
    const ids  = workers.map(w => w._id);
    const atts = await Attendance.find({ workerId: { $in: ids }, date: { $gte: qDate, $lt: qDateEnd } }).lean();
    const advs = await Advance.find({ workerId: { $in: ids }, date: { $gte: qDate, $lt: qDateEnd } }).lean();
    const attMap = {}, advMap = {}, advIdMap = {};
    atts.forEach(a => { attMap[a.workerId] = a; });
    advs.forEach(a => { advMap[a.workerId] = (advMap[a.workerId] || 0) + a.amount; advIdMap[a.workerId] = a._id; });
    const result = workers.map(w => ({ ...w, todayAttendance: attMap[w._id] || null, todayAdvance: advMap[w._id] || 0, todayAdvanceId: advIdMap[w._id] || null }));
    // Sort: workers with attendance marked today first, then by role, then by name
    const order = { manager: 0, mistry: 1, labour: 2, half_mistry: 3 };
    result.sort((a, b) => {
      const hasAttA = !!a.todayAttendance;
      const hasAttB = !!b.todayAttendance;
      if (hasAttA !== hasAttB) return hasAttB ? 1 : -1; // attendance marked first
      return ((order[a.role] ?? 9) - (order[b.role] ?? 9)) || a.name.localeCompare(b.name);
    });
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/attendance/fill-absent', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { date } = req.body;
    const fillDate = date ? toUTCDay(date) : getToday();
    const dayEnd   = new Date(fillDate.getTime() + 86400000);
    let workers;
    if (req.user.role === 'manager') {
      const subordinates = await User.find({ role: { $in: ['labour', 'mistry', 'half_mistry'] }, status: 'active', createdBy: req.user._id }).lean();
      const self = await User.findById(req.user._id).lean();
      workers = self ? [self, ...subordinates] : subordinates;
    } else {
      workers = await User.find({ status: 'active', role: { $ne: 'admin' } }).lean();
    }
    let count = 0;
    for (const w of workers) {
      const exists = await Attendance.findOne({ workerId: w._id, date: { $gte: fillDate, $lt: dayEnd } }).lean();
      if (!exists) { await Attendance.create({ workerId: w._id, date: fillDate, value: '0', markedBy: req.user._id }); count++; }
    }
    res.json({ success: true, count, message: `${count} workers marked absent` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/attendance/travel', auth, async (req, res) => {
  try {
    const { date, amount } = req.body;
    const attDate  = toUTCDay(date);
    const dayEnd   = new Date(attDate.getTime() + 86400000);
    const existing = await Attendance.findOne({ workerId: req.user._id, date: { $gte: attDate, $lt: dayEnd } }).lean();
    if (!existing) {
      const att = await Attendance.create({ workerId: req.user._id, date: attDate, value: '0', travelExpense: Number(amount) });
      res.json({ success: true, data: att.toObject() });
    } else {
      const updated = await Attendance.findByIdAndUpdate(existing._id, { $set: { travelExpense: Number(amount) } }, { new: true }).lean();
      res.json({ success: true, data: updated });
    }
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/attendance/travel/:workerId', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { date, amount } = req.body;
    const attDate  = toUTCDay(date);
    const dayEnd   = new Date(attDate.getTime() + 86400000);
    const existing = await Attendance.findOne({ workerId: req.params.workerId, date: { $gte: attDate, $lt: dayEnd } }).lean();
    if (!existing) {
      const att = await Attendance.create({ workerId: req.params.workerId, date: attDate, value: '0', travelExpense: Number(amount) });
      res.json({ success: true, data: att.toObject() });
    } else {
      const updated = await Attendance.findByIdAndUpdate(existing._id, { $set: { travelExpense: Number(amount) } }, { new: true }).lean();
      res.json({ success: true, data: updated });
    }
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/attendance/me', auth, async (req, res) => {
  try {
    const { month } = req.query;
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1), end = new Date(year, m, 1);
    const rawAtts  = await Attendance.find({ workerId: req.user._id, date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
    const advances = await Advance.find(   { workerId: req.user._id, date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
    const worker   = stripPw(await User.findById(req.user._id).lean());
    const attendances = await Promise.all(rawAtts.map(async a => {
      const marker = a.markedBy ? await User.findById(a.markedBy).lean() : null;
      return { ...a, markedBy: marker ? { _id: marker._id, name: marker.name } : null };
    }));
    const totalDays    = rawAtts.reduce((s, a) => s + parseFloat(a.value || 0), 0);
    const totalAdvance = advances.reduce((s, a) => s + a.amount, 0);
    const totalTravel  = rawAtts.reduce((s, a) => s + (a.travelExpense || 0), 0);
    const earned  = worker.rate * totalDays;
    const balance = earned - totalAdvance + totalTravel;
    res.json({ success: true, data: { attendances, advances, worker, totalDays, totalAdvance, totalTravel, earned, balance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/attendance/streak/:workerId', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const end   = getToday();
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const atts  = await Attendance.find({ workerId: req.params.workerId, date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean();
    res.json({ success: true, data: atts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/attendance', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { workerId, date, value } = req.body;
    const attDate  = toUTCDay(date);
    const dayEnd   = new Date(attDate.getTime() + 86400000);
    const existing = await Attendance.findOne({ workerId, date: { $gte: attDate, $lt: dayEnd } }).lean();
    const prevValue = existing ? existing.value : null;
    let attId;
    if (existing) {
      await Attendance.findByIdAndUpdate(existing._id, { $set: { value, markedBy: req.user._id } });
      attId = existing._id;
    } else {
      const att = await Attendance.create({ workerId, date: attDate, value, markedBy: req.user._id });
      attId = att._id;
    }
    const logEntry = await ActionLog.create({ performedBy: req.user._id, actionType: 'mark_attendance', targetUser: workerId, previousValue: prevValue, newValue: attId, date: attDate });
    res.json({ success: true, data: { attId, logId: logEntry._id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/attendance/:id', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { value } = req.body;
    const att = await Attendance.findById(req.params.id).lean();
    if (!att) return res.status(404).json({ success: false, message: 'Record not found' });
    const prev    = att.value;
    const updated = await Attendance.findByIdAndUpdate(req.params.id, { $set: { value, markedBy: req.user._id } }, { new: true }).lean();
    await ActionLog.create({ performedBy: req.user._id, actionType: 'edit_attendance', targetUser: att.workerId, previousValue: prev, newValue: value, date: att.date });
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ADVANCE ROUTES ───────────────
app.post('/api/advance', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { workerId, amount, date, note } = req.body;
    if (!workerId || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid worker and amount required' });
    const advDate  = date ? toUTCDay(date) : getToday();
    const dayEnd   = new Date(advDate.getTime() + 86400000);
    const existing = await Advance.findOne({ workerId, date: { $gte: advDate, $lt: dayEnd } }).lean();
    let advance;
    if (existing) {
      advance = await Advance.findByIdAndUpdate(existing._id, { $set: { amount: Number(amount), givenBy: req.user._id, note: note || '' } }, { new: true }).lean();
    } else {
      const doc = await Advance.create({ workerId, amount: Number(amount), date: advDate, givenBy: req.user._id, note: note || '' });
      advance = doc.toObject();
      await ActionLog.create({ performedBy: req.user._id, actionType: 'add_advance', targetUser: workerId, previousValue: null, newValue: doc._id, date: new Date() });
    }
    res.json({ success: true, data: advance });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/advance/:id', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const advance = await Advance.findById(req.params.id).lean();
    if (!advance) return res.status(404).json({ success: false, message: 'Advance not found' });
    const updated = await Advance.findByIdAndUpdate(req.params.id, { $set: { amount: Number(amount), givenBy: req.user._id } }, { new: true }).lean();
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/advance/:id', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const advance = await Advance.findByIdAndDelete(req.params.id).lean();
    if (!advance) return res.status(404).json({ success: false, message: 'Advance not found' });
    await ActionLog.create({ performedBy: req.user._id, actionType: 'remove_advance', targetUser: advance.workerId, previousValue: advance.amount, newValue: null, date: new Date() });
    res.json({ success: true, message: 'Advance removed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── ACTION LOG / UNDO ───────────────
app.get('/api/actions/log', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const since   = new Date(Date.now() - 30 * 60 * 1000);
    const rawLogs = await ActionLog.find({ performedBy: req.user._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10).lean();
    const logs = await Promise.all(rawLogs.map(async l => {
      const targetUser = l.targetUser ? await User.findById(l.targetUser).lean() : null;
      return { ...l, targetUser: targetUser ? { _id: targetUser._id, name: targetUser.name } : null };
    }));
    res.json({ success: true, data: logs });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/actions/undo', auth, role('admin', 'manager'), async (req, res) => {
  try {
    const { actionId } = req.body;
    const log = await ActionLog.findById(actionId).lean();
    if (!log) return res.status(404).json({ success: false, message: 'Action not found' });
    const since = new Date(Date.now() - 30 * 60 * 1000);
    if (new Date(log.createdAt) < since) return res.status(400).json({ success: false, message: 'Undo window has expired (30 min)' });

    if (log.actionType === 'mark_attendance') {
      if (log.previousValue === null) await Attendance.findByIdAndDelete(log.newValue);
      else await Attendance.findByIdAndUpdate(log.newValue, { $set: { value: log.previousValue } });
    } else if (log.actionType === 'add_advance') {
      await Advance.findByIdAndDelete(log.newValue);
    } else if (log.actionType === 'status_change') {
      await User.findByIdAndUpdate(log.targetUser, { $set: { status: log.previousValue } });
    }

    await ActionLog.findByIdAndDelete(actionId);
    res.json({ success: true, message: 'Action undone successfully' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─────────────── CRON — AUTO ABSENT 23:59 IST (18:29 UTC) ───────────────
cron.schedule('29 18 * * *', async () => {
  console.log('[CRON] Running auto-absent job...');
  try {
    const today   = getToday();
    const dayEnd  = new Date(today.getTime() + 86400000);
    const workers = await User.find({ status: 'active', role: { $ne: 'admin' } }).lean();
    let count = 0;
    for (const w of workers) {
      const exists = await Attendance.findOne({ workerId: w._id, date: { $gte: today, $lt: dayEnd } }).lean();
      if (!exists) { await Attendance.create({ workerId: w._id, date: today, value: '0', markedBy: null }); count++; }
    }
    console.log(`[CRON] Auto-absent applied to ${count} workers`);
  } catch (e) { console.error('[CRON] Error:', e.message); }
}, { timezone: 'UTC' });

// ─────────────── SEED + START ───────────────
async function seedAdmin() {
  try {
    const exists = await User.findOne({ mobile: process.env.ADMIN_MOBILE }).lean();
    if (!exists) {
      await User.create({ name: 'Admin', mobile: process.env.ADMIN_MOBILE, role: 'admin', password: process.env.ADMIN_PASSWORD, status: 'active' });
      console.log('[SEED] Admin user created:', process.env.ADMIN_MOBILE);
    } else {
      console.log('[SEED] Admin already exists');
    }
  } catch (e) { console.error('[SEED] Error:', e.message); }
}

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[DB] Connected to MongoDB Atlas');
    await seedAdmin();
    const server = app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
      console.log(`[SERVER] Running on port ${process.env.PORT || 5000}`);
    });
    server.on('error', (e) => { console.error('[SERVER] Error:', e.message); process.exit(1); });
    const shutdown = () => server.close(() => { mongoose.connection.close(); process.exit(0); });
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (e) {
    console.error('[DB] Connection failed:', e.message);
    process.exit(1);
  }
}

start();

// FILE: backend/models.js — Mongoose models for MongoDB Atlas
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

// ─── User ───────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  _id:             { type: String, default: () => randomUUID() },
  name:            { type: String, required: true },
  mobile:          { type: String, required: true },
  password:        { type: String, required: true },
  role:            { type: String, required: true },   // admin|manager|labour|mistry|half_mistry
  status:          { type: String, default: 'active' }, // active|disabled|long_leave
  rate:            { type: Number, default: 0 },
  photoUrl:        { type: String, default: null },
  createdBy:       { type: String, default: null },
  isHidden:        { type: Boolean, default: false },
  hiddenForManagers:{ type: [String], default: [] },
  disabledAt:      { type: String, default: null },
  longLeaveReason: { type: String, default: '' },
}, { timestamps: true });

// ─── Attendance ──────────────────────────────────────────────────────────────
const attendanceSchema = new mongoose.Schema({
  _id:           { type: String, default: () => randomUUID() },
  workerId:      { type: String, required: true },
  date:          { type: Date,   required: true },
  value:         { type: String, default: '0' },
  markedBy:      { type: String, default: null },
  travelExpense: { type: Number, default: 0 },
}, { timestamps: true });

// ─── Advance ─────────────────────────────────────────────────────────────────
const advanceSchema = new mongoose.Schema({
  _id:      { type: String, default: () => randomUUID() },
  workerId: { type: String, required: true },
  amount:   { type: Number, required: true },
  date:     { type: Date,   required: true },
  givenBy:  { type: String, default: null },
  note:     { type: String, default: '' },
}, { timestamps: true });

// ─── ActionLog ───────────────────────────────────────────────────────────────
const actionLogSchema = new mongoose.Schema({
  _id:           { type: String, default: () => randomUUID() },
  performedBy:   { type: String, required: true },
  actionType:    { type: String, required: true },
  targetUser:    { type: String, default: null },
  previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue:      { type: mongoose.Schema.Types.Mixed, default: null },
  date:          { type: Date,   default: null },
}, { timestamps: true });

const User       = mongoose.model('User',       userSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Advance    = mongoose.model('Advance',    advanceSchema);
const ActionLog  = mongoose.model('ActionLog',  actionLogSchema);

module.exports = { User, Attendance, Advance, ActionLog };

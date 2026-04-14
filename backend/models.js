// FILE: backend/models.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'labour', 'mistry', 'half_mistry'], required: true },
  rate: { type: Number, default: 0 },
  photoUrl: { type: String, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['active', 'disabled', 'long_leave'], default: 'active' },
  longLeaveReason: { type: String, default: '' },
  isHidden: { type: Boolean, default: false },
}, { timestamps: true });

const AttendanceSchema = new Schema({
  workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  value: { type: String, default: '0' },
  markedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  travelExpense: { type: Number, default: 0 },
}, { timestamps: true });

AttendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });

const AdvanceSchema = new Schema({
  workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  givenBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, default: '' },
}, { timestamps: true });

const ActionLogSchema = new Schema({
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actionType: {
    type: String,
    enum: ['mark_attendance', 'add_advance', 'edit_attendance', 'remove_advance', 'status_change'],
    required: true
  },
  targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
  previousValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  date: Date,
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Attendance: mongoose.model('Attendance', AttendanceSchema),
  Advance: mongoose.model('Advance', AdvanceSchema),
  ActionLog: mongoose.model('ActionLog', ActionLogSchema),
};
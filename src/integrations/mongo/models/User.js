import { mongoose } from '../connection.js';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 32 },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

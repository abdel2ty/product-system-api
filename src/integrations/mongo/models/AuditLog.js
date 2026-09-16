import { mongoose } from '../connection.js';

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entityId: { type: String, default: null },
  meta: { type: Object, default: {} },
  ip: { type: String, default: '' },
  at: { type: Date, default: Date.now },
});

auditSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const AuditLog = mongoose.model('AuditLog', auditSchema);

export function audit(action, { entityId = null, meta = {}, ip = '' } = {}) {
  // Logging must never break a request that already succeeded.
  AuditLog.create({ action, entityId, meta, ip }).catch(() => {});
}

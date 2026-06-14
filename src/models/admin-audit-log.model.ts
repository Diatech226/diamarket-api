import { Schema, model } from 'mongoose';

const AdminAuditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  resourceId: { type: String, index: true },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const AdminAuditLog = model('AdminAuditLog', AdminAuditLogSchema);

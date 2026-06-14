import { AdminAuditLog } from '../models/admin-audit-log.model';

export async function logAdminAction(actorId: string, action: string, resource: string, resourceId?: string, metadata?: unknown) {
  await AdminAuditLog.create({ actorId, action, resource, resourceId, metadata });
}

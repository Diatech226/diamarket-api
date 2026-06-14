import { AuthContext } from './requireAuth';

export function orderScope(auth: AuthContext): Record<string, unknown> {
  if (auth.role === 'admin') return {};
  if (auth.role === 'vendor' && auth.vendorId) return { vendor: auth.vendorId };
  return { customer: auth.userId };
}
export function ownerScope(auth: AuthContext, ownerField = 'ownerUserId'): Record<string, unknown> {
  return auth.role === 'admin' ? {} : { [ownerField]: auth.userId };
}

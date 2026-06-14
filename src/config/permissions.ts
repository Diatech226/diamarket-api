export const ROLES = ['user', 'vendor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  productsCreate: 'products:create', productsUpdate: 'products:update', productsDelete: 'products:delete',
  projectsCreate: 'projects:create', projectsUpdate: 'projects:update', projectsDelete: 'projects:delete',
  mediaManage: 'media:manage', ordersRead: 'orders:read', ordersUpdate: 'orders:update', paymentsRead: 'payments:read',
  shipmentsCreate: 'shipments:create', vendorsApprove: 'vendors:approve', settingsUpdate: 'settings:update', usersManage: 'users:manage',
  commissionsRead: 'commissions:read', commissionsManage: 'commissions:manage',
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  user: [PERMISSIONS.ordersRead],
  vendor: [PERMISSIONS.productsCreate, PERMISSIONS.productsUpdate, PERMISSIONS.projectsCreate, PERMISSIONS.projectsUpdate, PERMISSIONS.ordersRead, PERMISSIONS.ordersUpdate, PERMISSIONS.commissionsRead],
  admin: Object.values(PERMISSIONS),
};

export function isRole(value: unknown): value is Role { return typeof value === 'string' && ROLES.includes(value as Role); }
export function normalizeRole(value: unknown): Role | null {
  if (isRole(value)) return value;
  if (value === 'client' || value === 'viewer') return 'user';
  if (value === 'vendeur') return 'vendor';
  if (value === 'super_admin') return 'admin';
  return null;
}
export function hasPermission(role: string, permission: Permission) { return isRole(role) && ROLE_PERMISSIONS[role].includes(permission); }

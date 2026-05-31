export const ROLES = ['client', 'vendeur', 'marketplace_point_focal', 'agent_logistique', 'admin', 'super_admin'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  productsCreate: 'products:create',
  productsUpdate: 'products:update',
  productsDelete: 'products:delete',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsDelete: 'projects:delete',
  mediaManage: 'media:manage',
  ordersRead: 'orders:read',
  ordersUpdate: 'orders:update',
  paymentsRead: 'payments:read',
  shipmentsCreate: 'shipments:create',
  vendorsApprove: 'vendors:approve',
  settingsUpdate: 'settings:update',
  usersManage: 'users:manage',
  commissionsRead: 'commissions:read',
  commissionsManage: 'commissions:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  client: [PERMISSIONS.ordersRead],
  vendeur: [PERMISSIONS.productsCreate, PERMISSIONS.productsUpdate, PERMISSIONS.projectsCreate, PERMISSIONS.projectsUpdate, PERMISSIONS.ordersRead, PERMISSIONS.ordersUpdate, PERMISSIONS.commissionsRead],
  marketplace_point_focal: [PERMISSIONS.ordersRead, PERMISSIONS.ordersUpdate, PERMISSIONS.shipmentsCreate],
  agent_logistique: [PERMISSIONS.ordersRead, PERMISSIONS.ordersUpdate, PERMISSIONS.shipmentsCreate],
  admin: [
    PERMISSIONS.productsCreate,
    PERMISSIONS.productsUpdate,
    PERMISSIONS.productsDelete,
    PERMISSIONS.projectsCreate,
    PERMISSIONS.projectsUpdate,
    PERMISSIONS.projectsDelete,
    PERMISSIONS.mediaManage,
    PERMISSIONS.ordersRead,
    PERMISSIONS.ordersUpdate,
    PERMISSIONS.paymentsRead,
    PERMISSIONS.shipmentsCreate,
    PERMISSIONS.vendorsApprove,
    PERMISSIONS.usersManage,
    PERMISSIONS.commissionsManage,
  ],
  super_admin: Object.values(PERMISSIONS),
};

export function hasPermission(role: string, permission: Permission) {
  const roleKey = (ROLES.includes(role as Role) ? role : 'client') as Role;
  return ROLE_PERMISSIONS[roleKey].includes(permission);
}

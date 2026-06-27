import { env } from './env';

const publicUrl = process.env.API_PUBLIC_URL?.trim();
const devUrl = `http://localhost:${env.port || 5001}/api`;
const serverUrl = env.nodeEnv === 'production' && publicUrl ? publicUrl : devUrl;

const commonErrors = {
  BadRequest: { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
  Unauthorized: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
  Forbidden: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
  NotFound: { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
  ServerError: { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } }
};

const ok = (description = 'Success', schema: Record<string, unknown> = { type: 'object' }) => ({ description, content: { 'application/json': { schema } } });
const created = (description = 'Created', schema: Record<string, unknown> = { type: 'object' }) => ({ description, content: { 'application/json': { schema } } });
const secured = [{ bearerAuth: [] }];
const parameter = (name: string, description: string) => ({ name, in: 'path', required: true, description, schema: { type: 'string' } });
const list = (ref: string) => ({ type: 'array', items: { $ref: ref } });

export const swaggerEnabled = env.nodeEnv !== 'production' || process.env.ENABLE_SWAGGER === 'true';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: { title: 'Diamarket API', version: '1.0.0', description: 'API marketplace Diamarket' },
  servers: [{ url: serverUrl, description: env.nodeEnv === 'production' ? 'Production' : 'Development' }],
  tags: ['Auth', 'Products', 'Categories', 'Orders', 'Vendors', 'Users', 'Media', 'Settings', 'Shipping', 'Admin'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      User: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string', example: 'user@example.com' }, name: { type: 'string' }, role: { type: 'string', enum: ['user', 'vendor', 'admin'] }, status: { type: 'string', example: 'active' } } },
      Product: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', example: 'Produit Diamarket' }, description: { type: 'string' }, price: { type: 'number', example: 25000 }, currency: { type: 'string', example: 'XOF' }, categoryId: { type: 'string' }, vendorId: { type: 'string' }, stock: { type: 'integer', example: 12 }, images: { type: 'array', items: { $ref: '#/components/schemas/Media' } } } },
      Category: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', example: 'Électronique' }, slug: { type: 'string', example: 'electronique' }, description: { type: 'string' } } },
      Order: { type: 'object', properties: { id: { type: 'string' }, userId: { type: 'string' }, status: { type: 'string', example: 'pending' }, total: { type: 'number' }, currency: { type: 'string', example: 'XOF' }, shippingAddress: { $ref: '#/components/schemas/Address' } } },
      Vendor: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, status: { type: 'string', example: 'approved' }, userId: { type: 'string' } } },
      Address: { type: 'object', properties: { line1: { type: 'string' }, city: { type: 'string', example: 'Ouagadougou' }, country: { type: 'string', example: 'Burkina Faso' }, phone: { type: 'string' } } },
      Media: { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string', format: 'uri' }, type: { type: 'string', example: 'image/jpeg' }, alt: { type: 'string' } } },
      ApiError: { type: 'object', properties: { message: { type: 'string' }, code: { type: 'string' }, details: { type: 'object' } } }
    }
  },
  paths: {
    '/products': { get: { tags: ['Products'], summary: 'Lister les produits', responses: { 200: ok('Success', list('#/components/schemas/Product')), 500: commonErrors.ServerError } } },
    '/products/{id}': { get: { tags: ['Products'], summary: 'Afficher un produit', parameters: [parameter('id', 'Identifiant du produit')], responses: { 200: ok('Success', { $ref: '#/components/schemas/Product' }), 404: commonErrors.NotFound, 500: commonErrors.ServerError } } },
    '/categories': { get: { tags: ['Categories'], summary: 'Lister les catégories', responses: { 200: ok('Success', list('#/components/schemas/Category')), 500: commonErrors.ServerError } } },
    '/auth/register': { post: { tags: ['Auth'], summary: 'Créer un compte', responses: { 201: created('Created', { $ref: '#/components/schemas/User' }), 400: commonErrors.BadRequest, 500: commonErrors.ServerError } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Se connecter', responses: { 200: ok('Success'), 400: commonErrors.BadRequest, 401: commonErrors.Unauthorized, 500: commonErrors.ServerError } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Profil courant', security: secured, responses: { 200: ok('Success', { $ref: '#/components/schemas/User' }), 401: commonErrors.Unauthorized, 500: commonErrors.ServerError } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Se déconnecter', security: secured, responses: { 200: ok('Success'), 401: commonErrors.Unauthorized, 500: commonErrors.ServerError } } },
    ...Object.fromEntries([
      ['GET','/admin/dashboard','Admin','Tableau de bord admin'],['GET','/admin/products','Products','Lister les produits admin'],['POST','/admin/products','Products','Créer un produit'],['PUT','/admin/products/{id}','Products','Modifier un produit'],['DELETE','/admin/products/{id}','Products','Supprimer un produit'],['GET','/admin/categories','Categories','Lister les catégories admin'],['POST','/admin/categories','Categories','Créer une catégorie'],['PUT','/admin/categories/{id}','Categories','Modifier une catégorie'],['DELETE','/admin/categories/{id}','Categories','Supprimer une catégorie'],['GET','/admin/orders','Orders','Lister les commandes'],['GET','/admin/orders/{id}','Orders','Afficher une commande'],['PUT','/admin/orders/{id}/status','Orders','Modifier le statut commande'],['GET','/admin/vendors','Vendors','Lister les vendeurs'],['PUT','/admin/vendors/{id}/status','Vendors','Modifier le statut vendeur'],['GET','/admin/users','Users','Lister les utilisateurs'],['PUT','/admin/users/{id}/role','Users','Modifier le rôle utilisateur'],['PUT','/admin/users/{id}/status','Users','Modifier le statut utilisateur'],['POST','/orders/{id}/shipment','Shipping','Créer une expédition'],['POST','/orders/{id}/shipment/sync','Shipping','Synchroniser une expédition'],['GET','/orders/{id}/payment-status','Orders','Statut de paiement']
    ].map(([method, path, tag, summary]) => [path, { [method.toLowerCase()]: { tags: [tag], summary, security: secured, parameters: path.includes('{id}') ? [parameter('id', 'Identifiant de ressource')] : [], responses: { 200: ok('Success'), 201: created('Created'), 400: commonErrors.BadRequest, 401: commonErrors.Unauthorized, 403: commonErrors.Forbidden, 404: commonErrors.NotFound, 500: commonErrors.ServerError } } }]))
  }
};

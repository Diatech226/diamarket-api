# Diamarket API

## Setup

```bash
npm install
npm run dev
```

## Environment

See `.env.example`.

## Endpoints (Iteration 2)

### Products
- `GET /api/products` (pagination: `page`, `limit`; filtres: `category`, `vendor`, `status`, `isFeatured`; recherche: `search`)
- `GET /api/products/:slug`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Categories
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

### Vendor Requests
- `POST /api/vendor-requests`
- `GET /api/vendor-requests`
- `PUT /api/vendor-requests/:id/approve`
- `PUT /api/vendor-requests/:id/reject`

### Orders
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PUT /api/orders/:id/status`

## Status

### Order status
`pending`, `confirmed`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`

### Shipment status
`not_created`, `estimated`, `created`, `in_transit`, `delivered`, `failed`

## Auth headers (temporary Clerk bridge)
- `x-user-id`
- `x-user-role`

## JSON examples

### Create Product
```json
{
  "name": "Chaussures artisanales",
  "slug": "chaussures-artisanales",
  "description": "Fabriquées à Douala",
  "price": 25000,
  "currency": "FCFA",
  "images": ["https://cdn.example.com/p1.jpg"],
  "category": "665f0cfecfdd2a4f2d6d12aa",
  "vendor": "665f0cfecfdd2a4f2d6d12ab",
  "stock": 18,
  "weight": 0.9,
  "length": 30,
  "width": 20,
  "height": 12,
  "originCountry": "CM",
  "originCity": "Douala",
  "status": "active",
  "isFeatured": true,
  "isPromoted": false
}
```

### Create Order
```json
{
  "customer": "665f0cfecfdd2a4f2d6d12ac",
  "vendor": "665f0cfecfdd2a4f2d6d12ab",
  "items": [
    {
      "product": "665f0cfecfdd2a4f2d6d12ad",
      "name": "Chaussures artisanales",
      "quantity": 2,
      "unitPrice": 25000,
      "totalPrice": 50000
    }
  ],
  "totalAmount": 50000,
  "currency": "FCFA",
  "totalWeight": 1.8,
  "distanceKm": 35
}
```

## Iteration 7 Security
See ../SECURITY.md and API permissions middlewares for roles, permissions, and vendor workflow.

## Projects and media CMS flow

### Projects
- `GET /api/projects` lists projects with optional `page`, `limit`, `status`, `category`, and `search` query params.
- `GET /api/projects/:id` reads one project.
- `POST /api/projects` creates a project. Only `title` is required; all enrichment fields are optional.
- `PUT /api/projects/:id` updates any subset of project fields.
- `DELETE /api/projects/:id` removes a project.

Minimal project creation payload:

```json
{
  "title": "Villa témoin Ouaga 2000"
}
```

Optional project fields accepted by create/update include `description`, `category`, `status` (`draft`, `active`, `archived`), `coverImageUrl`, `coverMedia`, `galleryImageUrls`, `galleryMedia`, `media`, `links`, `startDate`, `endDate`, and `isFeatured`.

### Media library
- `GET /api/media` lists reusable CMS media assets.
- `POST /api/media/url` stores an external image URL in the media library.
- `POST /api/media/upload` imports a local image using JSON `{ "fileName": "cover.png", "dataUrl": "data:image/png;base64,..." }`; uploaded files are stored under `apps/diamarket-api/uploads` and served from `/uploads/:filename`.
- `PUT /api/media/:id` updates editable metadata such as `alt`, `originalName`, or `url`.
- `DELETE /api/media/:id` removes the media record and deletes the local file when applicable.

The media upload middleware accepts `jpeg`, `png`, `webp`, `gif`, and `svg` images up to 8 MB. URL-based media and uploaded media are both available for project cover and gallery selections.

## Diapay Checkout

`diamarket-api` est le seul composant Diamarket autorisé à utiliser `DIAPAY_SECRET_KEY`. Les frontends appellent les endpoints Diamarket suivants :

- `POST /api/payments/diapay/checkout-session` avec `{ "orderId": "..." }`
- `GET /api/payments/diapay/session/:sessionId`
- `POST /api/payments/diapay/webhook`
- `GET /api/orders/:id/payment-status`

Variables sandbox :

```env
DIAPAY_API_BASE_URL=http://localhost:5100
DIAPAY_SECRET_KEY=sk_test_xxx
DIAPAY_PUBLIC_KEY=pk_test_xxx
DIAPAY_WEBHOOK_SECRET=whsec_xxx
DIAMARKET_SUCCESS_URL=http://localhost:3000/orders/success
DIAMARKET_CANCEL_URL=http://localhost:3000/orders/cancel
```

La commande n’est jamais marquée payée par retour navigateur : seul un webhook Diapay signé, ou une vérification serveur équivalente, peut passer `paymentStatus` à `paid`.

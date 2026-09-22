# Backend API

The API is an Azure Functions isolated-worker modular monolith. HTTP triggers are thin; domain services own validation and SQL transactions.

## Implemented contracts

- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/pos/bootstrap`
- `POST /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders/{id}/status`
- `POST /api/orders/{id}/cancel`
- `POST /api/orders/{id}/refund`
- `GET /api/kds/orders/active`
- `POST /api/kds/orders/{id}/status`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `POST /api/purchases/receive`
- `GET /api/inventory`
- `GET /api/stock-movements`
- `GET /api/sales`
- `GET /api/reports/sales`

Later customer, purchasing, farm, recipe, and production APIs are roadmap-only and are intentionally not part of this milestone build.

Every request derives organization, user, location, and role from verified identity context. Browser-supplied tenant identity is never authoritative.

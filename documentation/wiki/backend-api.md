# Backend API

The API is an Azure Functions isolated-worker modular monolith. HTTP triggers are thin; domain services own validation and SQL transactions.

## Implemented contracts

- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/pos/bootstrap`
- `POST /api/categories`
- `PATCH /api/categories/{id}`
- `POST /api/orders`
- `GET /api/orders/{id}`
- `POST /api/orders/{id}/status`
- `POST /api/orders/{id}/cancel`
- `POST /api/orders/{id}/refund`
- `GET /api/kds/orders/active`
- `POST /api/kds/orders/{id}/status`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PATCH /api/suppliers/{id}`
- `GET /api/purchases`
- `POST /api/purchases/receive`
- `PATCH /api/purchases/{id}`
- `GET /api/inventory`
- `GET /api/stock-movements`
- `GET /api/sales`
- `GET /api/reports/sales`

Later customer, purchasing, farm, recipe, and production APIs are roadmap-only and are intentionally not part of this milestone build.

Every request derives organization, user, location, and role from verified identity context. Browser-supplied tenant identity is never authoritative.

Product bootstrap responses include HSN, GST, computed CGST, computed SGST, and `trackInventory`. Purchase receiving is limited to inventory-tracked products; prepared products, menu items, services, and non-stock items are not received as stock, but remain sellable through POS without inventory mutation.

Vendor and purchase edits remain organization- and location-scoped. Editing a received purchase reverses its previous inventory receipt and applies the replacement lines in one serializable transaction; the API rejects edits that would make on-hand inventory negative.

Categories support active top-level departments and optional subcategories. Deactivation is a soft operation: it hides the category from active bootstrap/catalog selection while preserving existing products and history.

The current frontend provides catalog filters by name/SKU, category, and HSN, plus purchase and sales filters for search, daily/weekly/monthly/custom dates, and grouping. Vendors and Purchases are separate Operations subviews. KDS is a separate mode and is not rendered inside the POS view. Non-tracked prepared, service, and non-stock products remain orderable, while tracked products are checked against stock.

Catalog administration is presented as separate Categories and Products subviews. Non-tracked active products are displayed as orderable prepared/service/non-stock items; only tracked products are subject to stock availability checks and inventory deduction.

Initial role policy: `OrganizationOwner`, `OperationsManager`, and `StoreManager` receive the full POS, KDS, Catalog, and Operations menus. `Cashier` receives POS and purchase receiving only. Cashier purchase receiving uses `inventory.purchase.receive`, while purchase editing remains restricted to the stronger `inventory.adjust` permission.

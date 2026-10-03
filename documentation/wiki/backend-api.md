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
- `PATCH /api/settings/kds`
- `PATCH /api/settings/time-zone`
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

## Authentication and application RBAC

The deployed frontend uses Microsoft Entra ID through MSAL. It requests the backend API delegated scope `api://<backend-api-client-id>/user_impersonation` and sends the resulting bearer token to the Functions API. The backend Function App authentication configuration validates the issuer and audience before the application code runs.

`GET /api/auth/me` resolves the Entra `oid` claim (falling back to `sub`) through `Users.ExternalSubject`, then loads the user's organization, location, and role from `UserLocations` and `UserRoles`. Application authorization is separate from Azure RBAC: the user must be active in `Users`, assigned to the organization and location, and mapped through `UserRoles` to a role with the required `RolePermissions`. The initial UI load requires the catalog read permission. A user with only Azure `Reader`, `Contributor`, or `Owner` access is not automatically a Counterpoint user.

Provision each production user in SQL after applying the migrations: store the Entra object ID in `Users.ExternalSubject`, add a `UserLocations` row, and add a `UserRoles` row for a role with the required permissions. The Development-only local auth bypass is documented in [Local development](local-development.md) and must not be used in Azure.

Product bootstrap responses include HSN, GST, computed CGST, computed SGST, and `trackInventory`. Purchase receiving accepts inventory-tracked products and `SERVICE` products. A service purchase line records expense quantity and unit cost without creating inventory balances or stock movements; other non-tracked types remain excluded. Purchase lines retain an `affectsInventory` flag so editing reverses only the stock changes made when that line was received.

POS product prices are gross amounts. During order creation, the server calculates line GST as `gross * GST rate / 100`, stores the net line sum as `Orders.Subtotal`, stores the GST sum as `Orders.Tax`, and stores gross as `Orders.Total` (`subtotal + tax`). Payment capture uses the gross order total.

New invoice numbers use the organization's configured business date and a transactionally allocated per-organization daily sequence (`yyMMdd-0001`, `yyMMdd-0002`, ...). The suffix has a minimum width of four digits and expands after `9999`. Existing invoice numbers are unchanged; if a legacy number occupies the next sequence value, allocation skips it. The sequence row and order insert commit in the same serializable transaction.

When a product's explicit GST rate is zero for legacy data, order creation falls back to the linked tax-rule rate and derives equal CGST and SGST rates. Receipt item Tax displays the GST amount only; the rate is not repeated in that column. Receipt totals show Sub Total, CGST, SGST, and TOTAL without a separate GST row.

`GET /api/pos/bootstrap` also returns `businessLocation` with the organization name, active location name, optional location GST number, and organization `timeZone`. Browser receipts use these values for the business header and format the sale time in the configured organization timezone.

`PATCH /api/settings/time-zone` updates `Organizations.TimeZone` for the authenticated organization and requires `locations.manage`. Store a validated IANA identifier such as `Asia/Kolkata`, not an abbreviation such as `IST`. Order and operational timestamps remain UTC in SQL; changing this setting does not modify old or new `CreatedAt` values. The UI formats timestamps in this timezone. `GET /api/sales` and `GET /api/reports/sales` accept optional `from` and `to` values as `yyyy-MM-dd` business-local dates; summary requests require both dates or neither. The API converts local midnight boundaries to UTC and queries a half-open range, correctly accounting for timezone offset changes. Without a date range, sales history retains its recent-100-order limit; a requested date range returns all orders in that range.

Vendor and purchase edits remain organization- and location-scoped. Editing a received purchase reverses its previous inventory-affecting lines and applies the replacement lines in one serializable transaction; service expense lines are retained in purchase totals without inventory updates. The API rejects edits that would make on-hand inventory negative.

Categories support active top-level departments and optional subcategories. Deactivation is a soft operation: it hides the category from active bootstrap/catalog selection while preserving existing products and history.

The current frontend provides catalog filters by name/SKU, category, and HSN, plus purchase and sales filters for search, daily/weekly/monthly/custom dates, and grouping. Sales history can additionally group by payment type (Cash/UPI); the API returns the successful payment method with each order without duplicating its lines. Purchase filters and grouping controls are contained within the purchase list panel, and receiving uses a searchable inventory-product field. Choosing a group-by value (name, category, HSN, invoice/reference, or payment type in sales) re-renders the table as line items grouped under subtotal header rows instead of the default one-row-per-receipt/one-row-per-sold-item view; purchase lines resolve category and HSN from the bootstrap product/category lists since `PurchaseLine` itself only carries `productId`/`productName`. Vendors and Purchases are separate Operations subviews. KDS is a separate mode and is not rendered inside the POS view. Non-tracked prepared, service, and non-stock products remain orderable, while tracked products are checked against stock.

Sales history returns the successful payment method (`paymentMethod`) with each order and is rendered one row per sold item. It includes invoice, HSN, category, item, sale date/time, quantity, gross amount, GST rate and amount, CGST rate and amount, SGST rate and amount, and net amount. The frontend calculates these display values from gross (`unit price * quantity`): CGST is `gross * CGST rate / 100`, SGST is `gross * SGST rate / 100`, GST is CGST plus SGST, and net is gross minus GST. Without date bounds, `GET /api/sales` caps results at the 100 most recent **orders**, joining to order items afterwards, so a capped order's lines are never split across the cap boundary. A bounded date query returns every matching order so business-day sales summaries aren't truncated.

Catalog administration is presented as separate Categories and Products subviews. Non-tracked active products are displayed as orderable prepared/service/non-stock items; only tracked products are subject to stock availability checks and inventory deduction.

Initial role policy: `OrganizationOwner`, `OperationsManager`, and `StoreManager` receive the full POS, KDS, Catalog, and Operations menus. `Cashier` receives POS and purchase receiving only. Cashier purchase receiving uses `inventory.purchase.receive`, while purchase editing remains restricted to the stronger `inventory.adjust` permission.

KDS enablement is stored per location in `Locations.KdsEnabled` and defaults to enabled for existing locations. `GET /api/pos/bootstrap` includes the setting in `businessLocation`; `PATCH /api/settings/kds` updates it for the authenticated location and requires `locations.manage` (granted to OrganizationOwner, OperationsManager, and StoreManager). When disabled, new orders do not create KDS work, active KDS queries return no work, and KDS status updates are rejected until re-enabled.

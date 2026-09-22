# Azure SQL migrations

Migrations are ordered and must be applied once, in filename order, by the deployment pipeline against the target Azure SQL database.

The first production milestone covers:

1. Organizations, users, roles, locations, and registers
2. Catalog, location prices, taxes, and preparation stations
3. Inventory balances and append-only stock movements
4. Orders, order items, and idempotency keys
5. Payments and payment state history
6. KDS work items and status history
7. Inventory batches, lot traceability, reservations, and available stock
8. Permissions, user-location assignments, devices, and audit events
9. Suppliers, purchases, purchase lines, and receiving operations

The application never creates or alters schema at startup. Production migrations require review and must be backward-compatible with the deployed Functions version.

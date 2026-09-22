# Database Migrations

Azure SQL migrations are ordered scripts under `database/migrations`.

- `001_foundation.sql`: organizations, users, roles, locations, registers
- `002_catalog.sql`: categories, products, prices, taxes, modifiers, stations
- `003_inventory.sql`: balances and stock ledger
- `004_orders.sql`: orders and idempotency
- `005_payments.sql`: payments and state history
- `006_kds.sql`: KDS work and history
- `007_customer-commerce.sql`: customers, media, delivery and customer order access
- `008_purchasing.sql`: suppliers, purchases, receipts and batches
- `009_farm-production.sql`: farms, harvests, recipes, production and traceability

Migrations must be applied in filename order. The application does not mutate schema at startup.

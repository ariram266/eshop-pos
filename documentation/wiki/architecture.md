# Architecture and Phase Plan

Counterpoint is a cloud-first modular monolith:

`React PWA -> Azure Static Web Apps -> Azure Functions Flex -> Azure SQL`

Supporting services are Blob Storage, Web PubSub, Key Vault, Application Insights, Azure Monitor, Bicep, and GitHub Actions.

## Delivery phases

- Phase 0: platform foundation, identity, tenant/location authorization, migrations, infrastructure, CI.
- Phase 1: catalog, POS, orders, payment abstraction, inventory, receipts, KDS.
- Phase 2: customer identity, customer-safe catalog, media, pickup/delivery, tracking, notifications.
- Phase 3: suppliers, purchasing, receiving, farms, harvests, batches, transfers, waste, recipes, production, traceability, costing.

Offline transactions, SQLite, a Windows POS Agent, PostgreSQL, App Service as the API, Redis, Service Bus, Event Grid, Kubernetes, and microservices are excluded.

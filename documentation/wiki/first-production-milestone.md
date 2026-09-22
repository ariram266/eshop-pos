# First Production Milestone

The updated specification defines the first production milestone at the completion of Phase 5:

`Catalog -> POS -> Order -> Payment -> Inventory -> KDS -> Receipt`

Included in this milestone:

- .NET 10 isolated Azure Functions
- Azure SQL source of truth
- EF Core SQL Server model foundation
- Entra authentication with a Development-only local actor
- Organization, location, role, permission, register, and device boundaries
- Catalog bootstrap with categories, products, pricing, taxes, modifiers, and stations
- Server-authoritative order totals and payment recording
- Serializable/idempotent order transaction
- Guarded inventory decrement and append-only stock movement
- KDS pending, accepted, preparing, ready, completed, and cancelled transitions
- SQL recovery endpoint for missed KDS notifications
- Post-commit Web PubSub notification hook
- Browser receipt printing
- Correlation-aware health endpoint
- .NET, frontend, migration, Bicep, and dependency CI gates

Not part of this milestone: customer commerce, farm operations, purchasing, recipes, production, reporting, refunds, and booking. Those remain after the first production milestone in the updated specification.

# POS services

The backend is split along the boundaries in `spec.md`:

- `CloudApi`: cloud-facing product, order, and idempotent sync endpoints.
- `PosAgent`: loopback-only Windows hardware abstraction API on `127.0.0.1:9100`.

`CloudApi` uses PostgreSQL and creates the Phase 1 schema on startup. `PosAgent` uses a mock printer behind `IReceiptPrinter` until a physical adapter is installed.

Start PostgreSQL first, then run either service with `dotnet run --project backend/CloudApi` or `dotnet run --project backend/PosAgent` once .NET 10 is installed.
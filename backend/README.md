# Backend

The backend target is an Azure Functions isolated-worker modular monolith backed by Azure SQL Database.

Planned modules follow `specs.md`:

- Auth and tenant resolution
- Catalog and POS
- Orders and payments
- Inventory
- KDS and Web PubSub notifications

Business rules belong in shared application/domain services. HTTP triggers remain thin. Azure SQL is the operational source of truth, and all tenant and location authorization is enforced server-side.

No PostgreSQL, App Service API, SQLite POS Agent, local synchronization service, or offline transaction implementation belongs in this repository.

## Local backend

Install the Azure Functions Core Tools and use a SQL Server/Azure SQL-compatible database. Set `AZURE_SQL_CONNECTION_STRING` in `backend/CloudApi/local.settings.json`, apply the ordered scripts under `database/migrations`, then run:

```sh
docker compose -f docker-compose.local.yml up -d
# Apply database/migrations/*.sql followed by database/seeds/001_local_dev.sql with sqlcmd.
cd backend/CloudApi
func start
```

With the checked-in local settings, Functions uses a deterministic local organization, location, register, and `OrganizationOwner` actor. This bypass is enabled only for the Development environment and must never be enabled in Azure.

The implemented Phase 1 endpoints are:

- `GET /api/auth/me`
- `GET /api/pos/bootstrap`
- `POST /api/orders` with `Idempotency-Key`
- `GET /api/kds/orders/active`
- `POST /api/kds/orders/{id}/status`

Production authentication is supplied by Microsoft Entra External ID. The API requires verified organization, user, location, and role claims; browser-provided tenant or location identifiers are not trusted.
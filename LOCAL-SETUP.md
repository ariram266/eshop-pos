# Local Development Setup

This repository follows the cloud-first architecture in [specs.md](specs.md).

## Current runnable surface

The React/Vite frontend and Azure Functions Phase 1 vertical slice are implemented. POS transactions call the Azure Functions API over HTTPS; no offline transaction mode exists.

```sh
npm install
npm run dev
```

The production bundle can be checked with:

```sh
npm run build
```

## Target backend prerequisites

The backend implementation will use:

- Azure Functions isolated worker
- Azure SQL Database or a SQL Server-compatible local database
- Microsoft Entra External ID
- Azure Key Vault for secrets
- Azure Web PubSub for notifications

Apply `database/migrations/001_foundation.sql` through `006_kds.sql` in order before starting the Functions host. The API expects `AZURE_SQL_CONNECTION_STRING` and verified Entra claims.

For local testing without Azure login:

```sh
docker compose -f docker-compose.local.yml up -d
# Apply database/migrations/*.sql and database/seeds/001_local_dev.sql with sqlcmd.
cd backend/CloudApi
func start
```

The checked-in local settings enable a deterministic Development-only actor. Production and staging still require Microsoft Entra External ID claims.

Do not add PostgreSQL, SQLite, a local POS Agent, a synchronization queue, or local transaction persistence. These are explicitly excluded in `specs.md`.

## Environment

Create `.env.local` only for non-secret frontend configuration:

```env
VITE_CLOUD_API_URL=https://<functions-app>.azurewebsites.net
VITE_ENTRA_CLIENT_ID=<static-web-app-client-id>
VITE_ENTRA_TENANT_ID=<external-id-tenant-id>
VITE_ENTRA_API_CLIENT_ID=<functions-api-client-id>
VITE_REGISTER_CODE=register-01
```

Never commit credentials, tokens, connection strings, or production URLs.

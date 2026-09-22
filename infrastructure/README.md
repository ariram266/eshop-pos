# Infrastructure

Infrastructure must be implemented with Bicep according to `specs.md`.

Required resource modules:

- Azure Static Web Apps
- Azure Functions Flex Consumption
- Azure SQL Database
- Azure Blob Storage
- Azure Web PubSub
- Azure Key Vault
- Application Insights and Azure Monitor

Required environments:

- Development
- Staging
- Production

`main.bicep` composes the modules in this directory and provisions the Phase 1 target resources. The Functions app receives its SQL connection through a Key Vault reference, and Web PubSub is notification-only; SQL remains authoritative.

The deployment must provide `COUNTERPOINT_ENTRA_CLIENT_ID`, `COUNTERPOINT_ENTRA_OPENID_ISSUER`, and the corresponding frontend Entra variables. The API app is configured to reject unauthenticated requests.

Each environment must be isolated. Secrets must be supplied through managed identity and Key Vault references. Do not provision PostgreSQL, App Service as the primary API, Redis, Service Bus, Event Grid, containers, or Kubernetes.

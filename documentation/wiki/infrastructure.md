# Infrastructure and Deployment

## Prerequisites

Before deploying to Azure, the environment must satisfy the following prerequisites:

### Required Azure resources

- Azure subscription and resource group for each environment
- Azure Static Web Apps
- Azure Functions Flex Consumption
- Azure SQL Database
- Azure Blob Storage
- Azure Web PubSub
- Azure Key Vault
- Application Insights and Azure Monitor

### Required identity and configuration

- Microsoft Entra ID tenant
- App registrations for the frontend SPA and Functions API
- Entra client IDs and tenant IDs
- API audience and scope configuration
- Managed identity or Key Vault-based secret references

### Required deployment tooling

- Azure CLI
- Bicep CLI
- GitHub Actions access to Azure
- Environment secrets for deployment tokens, Entra metadata, and SQL references

### Validation before deployment

Run the project checks locally before deploying:

```sh
npm install
npm run typecheck
npm test -- --run
npm run build
```

Then validate the backend:

```sh
export PATH="/opt/homebrew/opt/dotnet@10/bin:$PATH"
dotnet build backend/CloudApi/CloudApi.csproj --configuration Release
dotnet test backend/CloudApi.Tests/CloudApi.Tests.csproj --configuration Release
```

### Deployment guardrails

- Do not enable local auth bypass in Azure.
- Keep Azure SQL as the authoritative system of record.
- Keep Web PubSub as notification-only.
- Use Bicep for all infrastructure definitions.
- Do not add PostgreSQL, SQLite, local POS agents, or extra distributed services without updating the specification first.

Bicep provisions isolated Development, Staging, and Production resources. Secrets are provided by GitHub environment secrets and Key Vault references. Deployments run through GitHub Actions; production requires protected approval.

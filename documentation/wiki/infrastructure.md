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

## Bicep, Azure CLI, and GitHub Actions

These tools have different roles in the deployment process:

- **Bicep** defines the Azure infrastructure declaratively. In this repository, [infrastructure/main.bicep](../../infrastructure/main.bicep) composes the Storage Account, SQL Database, Function App, Static Web App, Key Vault, Application Insights, and Web PubSub modules.
- **Azure CLI** executes Bicep deployments manually from a developer workstation. It is useful for the first deployment, validation, and troubleshooting.
- **GitHub Actions** automates the same build and deployment process after code changes. The workflow can run Azure CLI commands using a configured Azure identity, so it is an automation layer rather than a replacement for the Bicep templates.

The recommended progression is:

1. Use Azure CLI and Bicep for the first Development deployment.
2. Validate the provisioned resources and application configuration.
3. Use GitHub Actions for repeatable Development deployments.
4. Add protected approval gates before Staging or Production deployment.

Validate the template before creating resources:

```sh
az bicep build --file infrastructure/main.bicep

az deployment group what-if \
	--resource-group rg-counterpoint-dev \
	--template-file infrastructure/main.bicep \
	--parameters environment=dev location=eastus2 sqlLocation=centralus frontendOrigin=https://witty-field-0f855da10.3.azurestaticapps.net \
		sqlAdministratorPassword="$COUNTERPOINT_SQL_ADMIN_PASSWORD" \
		entraClientId="$COUNTERPOINT_ENTRA_CLIENT_ID" \
		entraOpenIdIssuer="$COUNTERPOINT_ENTRA_OPENID_ISSUER"
```

## Azure Free subscription considerations

An Azure Free subscription can be used for development, but the subscription, region, and current Microsoft offer determine which services and SKUs are free. Bicep does not make a paid SKU free. Review the pricing tier for every resource before deployment and monitor the subscription cost and quota views.

The current template should be reviewed before using it with a Free subscription because it defines paid or potentially billable configurations, including:

- Azure SQL Database using the `Basic` tier
- Static Web App using the `Standard` tier
- Azure Functions using the `FlexConsumption` plan
- Storage, Key Vault, and Application Insights, which may consume free allowances and become billable after those allowances are exceeded
- Web PubSub using its `Free_F1` tier, subject to its free-tier limits

Before deployment, confirm that each selected SKU is available for the target region and subscription. If the goal is to remain within free allowances, use Free-compatible SKUs or service alternatives in a separate Development parameter set. Do not assume that a resource is free solely because the subscription is labelled Free.

The first deployment should therefore use `what-if`, followed by a cost and quota review. Never enable `COUNTERPOINT_LOCAL_DEV_AUTH` or any other local development bypass in Azure, regardless of the selected subscription tier.

## Azure CLI deployment runbook

This runbook is intended for a first Development deployment from a local workstation. It uses Azure CLI to execute the repository's Bicep template. The template creates the SQL, Functions, Static Web App, Storage, Key Vault, Application Insights, and Web PubSub resources; do not create those resources manually first.

### 1. Install Azure CLI and Bicep

Install Azure CLI on the machine used for the initial deployment:

```sh
# macOS with Homebrew
brew update
brew install azure-cli

# Ubuntu/Debian: follow the current Microsoft package instructions:
# https://learn.microsoft.com/cli/azure/install-azure-cli-linux
```

On Windows, install the current Azure CLI MSI or use `winget install Microsoft.AzureCLI`. Verify the installation and install the Bicep CLI through Azure CLI:

```sh
az version
az bicep install
az bicep version
```

The repository uses Azure CLI's Bicep integration; a separate standalone Bicep installation is not required. Keep Azure CLI and Bicep current on both local machines and CI runners.

### 2. Entra identities and permissions

Use separate identities for people, application authentication, and automation:

- **Human deployment user:** an existing Microsoft Entra user who signs in with `az login`. This user creates the resource group, app registrations, and initial deployment. Do not share this account or use it from GitHub Actions.
- **Backend API app registration:** the audience used by the Function App authentication configuration. This is the `entraClientId` passed to Bicep and is not the deployment identity.
- **Frontend SPA app registration:** the public client used by the React application. It needs the backend API's delegated `user_impersonation` permission.
- **GitHub Actions service principal:** a separate Entra application/service principal used by `azure/login`. The checked-in workflow expects its JSON credentials in the `AZURE_CREDENTIALS` GitHub secret.

#### What is required for a user to enter the UI

For a deployed UI, the user needs all of the following:

1. A user account in the Entra tenant used by `VITE_ENTRA_TENANT_ID`.
2. The frontend SPA app registration in `VITE_ENTRA_CLIENT_ID`, with the deployed HTTPS URL registered under **Single-page application** redirect URIs.
3. The frontend app granted delegated permission to the backend API scope `api://<backend-api-client-id>/user_impersonation`. Grant tenant-wide admin consent when the tenant requires it.
4. The Function App configured with the backend API app/client ID and the v2 issuer. Bicep sets these through `entraClientId` and `entraOpenIdIssuer`, and Azure App Service authentication rejects unauthenticated requests.
5. A valid bearer token accepted by the Function App and an application authorization record for the user.

The UI calls `GET /api/auth/me` immediately after login. The Function App must accept the API audience `api://<backend-api-client-id>` because the frontend requests `api://<backend-api-client-id>/user_impersonation`. The current backend then resolves the verified Entra subject through the internal SQL user, organization/location assignment, active flag, role, and permission before returning POS data. Azure subscription roles such as `Reader` or `Contributor` do not grant a Counterpoint user access to POS, KDS, Catalog, or Operations.

The backend resolves the Entra object ID through the Counterpoint SQL user and role assignments. After applying the database migrations, provision each Entra user in `Users`, `UserLocations`, and `UserRoles`; without those records the user can authenticate but will receive `401` from `/api/auth/me`. This is application RBAC, not Azure RBAC. Do not work around it by granting the user Azure `Owner` or `Contributor`.

Local Development is different: when `COUNTERPOINT_LOCAL_DEV_AUTH=true` and `AZURE_FUNCTIONS_ENVIRONMENT=Development`, the UI uses the selected local role and sends `X-Local-Dev-Role`. That bypass must never be enabled in Azure.

The human user needs these permissions before the first deployment:

| Task | Minimum permission |
| --- | --- |
| Select the subscription and create the resource group | Azure subscription `Contributor` if the resource group does not exist; otherwise resource-group `Contributor` |
| Deploy the current Bicep template | Resource-group `Contributor` |
| Create or modify API and SPA app registrations | Entra `Application Administrator`, `Cloud Application Administrator`, or an allowed app-registration role/policy |
| Create Entra users, if required | Entra `User Administrator` |
| Create the GitHub service principal and assign its Azure role | Entra permission to create service principals plus Azure `Owner` or `User Access Administrator` at the resource-group scope |
| Deploy the Flex Function App managed-identity role assignment | Azure `Owner` or `User Access Administrator` at the resource-group scope; `Contributor` alone cannot create role assignments |

Creating a normal Entra user is usually a tenant-administrator operation and is not part of Bicep. In the Entra admin center, create the user under **Identity > Users > New user**, require a first sign-in password change, and assign only the directory role needed for the setup. Do not assign `Global Administrator` just to deploy Azure resources.

Create the GitHub Actions service principal after the resource group exists, scoped only to that resource group:

```sh
export AZURE_SUBSCRIPTION_ID="$(az account show --query id --output tsv)"
export AZURE_RESOURCE_GROUP="rg-counterpoint-dev"
export GITHUB_SP_NAME="counterpoint-github-dev"

az ad sp create-for-rbac \
	--name "$GITHUB_SP_NAME" \
	--role Contributor \
	--scopes "/subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/$AZURE_RESOURCE_GROUP" \
	--json-auth
```

Store the complete JSON output as the GitHub Actions secret `AZURE_CREDENTIALS`. Keep the service-principal secret out of shell history, source control, and logs. For production, use a separate service principal and GitHub environment, preferably with federated workload identity instead of a client secret. The service principal needs `Contributor` on the target resource group for the current workflow; it does not need `Owner` unless the deployment is changed to create role assignments.

### 3. Sign in and select the subscription

Sign in as the human deployment user:

```sh
az login
az account list --output table
az account set --subscription "<subscription-id-or-name>"
az account show --output table
```

Record the tenant ID for the Entra configuration:

```sh
export AZURE_TENANT_ID="$(az account show --query tenantId --output tsv)"
```

For an Azure Free subscription, confirm the selected subscription, region, spending limits, quotas, and current free-service offers in the Azure portal before proceeding.

### 4. Create the resource group

Choose a region supported by the required services. The resource group location is used by most modules in this template.

```sh
export AZURE_LOCATION="eastus2"
export AZURE_RESOURCE_GROUP="rg-counterpoint-dev"

az group create \
	--name "$AZURE_RESOURCE_GROUP" \
	--location "$AZURE_LOCATION" \
	--tags application=counterpoint environment=dev
```

The Static Web App module currently uses its own default location. Confirm that its selected location is available for the subscription before deployment. Azure SQL provisioning was restricted in both `eastus` and `eastus2` for the reported subscription, so the Development baseline keeps application resources in `eastus2` and places SQL in `centralus`. Confirm `centralus` in the portal before deployment; change `sqlLocation` if the subscription restricts that region too.

If an earlier deployment created resources in another region, do not reuse the same resource group while changing `location`. Azure resources such as SQL servers, Storage accounts, Application Insights workspaces, and Web PubSub instances cannot be moved by redeploying the same name. Create a new resource group for the new region, and inspect the original group before deleting it:

```sh
export AZURE_RESOURCE_GROUP="rg-counterpoint-dev-eastus2"
az group create \
	--name "$AZURE_RESOURCE_GROUP" \
	--location eastus2 \
	--tags application=counterpoint environment=dev

az resource list \
	--resource-group rg-counterpoint-dev \
	--output table
```

The failed `rg-counterpoint-dev` deployment can be removed only after confirming that it contains no resources you need:

```sh
# Destructive: run only after reviewing the resource list.
az group delete --name rg-counterpoint-dev --yes --no-wait
```

### 5. Create the Entra backend API application

Bicep does not create Entra app registrations. Create the backend API registration before running the Bicep deployment because the Function App authentication configuration requires its client ID and issuer.

```sh
az ad app create \
	--display-name "counterpoint-dev-api" \
	--sign-in-audience AzureADMyOrg

export API_APP_ID="<backend-api-application-client-id>"
az ad sp create --id "$API_APP_ID"
az ad app update \
	--id "$API_APP_ID" \
	--identifier-uris "api://$API_APP_ID"
```

In the Entra admin center, expose a delegated API scope such as `user_impersonation` for this application. The scope should be represented as `api://<backend-api-client-id>/user_impersonation`. Record the client ID and issuer:

```sh
export COUNTERPOINT_ENTRA_CLIENT_ID="$API_APP_ID"
export COUNTERPOINT_ENTRA_OPENID_ISSUER="https://login.microsoftonline.com/$AZURE_TENANT_ID/v2.0"
```

### 6. Create the Entra frontend SPA application

Create a separate SPA registration for the React frontend:

```sh
az ad app create \
	--display-name "counterpoint-dev-web" \
	--sign-in-audience AzureADMyOrg

export FRONTEND_APP_ID="<frontend-spa-application-client-id>"
az ad sp create --id "$FRONTEND_APP_ID"
```

Add a Single-page application redirect URI for the deployed Static Web App after its hostname is known. Grant the frontend delegated permission to the backend API's `user_impersonation` scope. The frontend build uses the resulting tenant and client IDs.

### 7. Export the Bicep deployment parameters

The environment parameter file reads these values from the shell environment. Set the SQL administrator password without printing it to the terminal history or committing it:

```sh
read -s COUNTERPOINT_SQL_ADMIN_PASSWORD
export COUNTERPOINT_SQL_ADMIN_PASSWORD
export COUNTERPOINT_ENTRA_CLIENT_ID="$API_APP_ID"
export COUNTERPOINT_ENTRA_OPENID_ISSUER="https://login.microsoftonline.com/$AZURE_TENANT_ID/v2.0"
```

The password must satisfy Azure SQL password rules. The deployment creates the `counterpoint` database and stores its connection string in Key Vault. Use a separate password for each environment.

### 8. Validate and preview the deployment

Build the Bicep template and preview the changes before creating resources:

```sh
az bicep build --file infrastructure/main.bicep

az deployment group what-if \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--template-file infrastructure/main.bicep \
	--parameters environment=dev location=eastus2 sqlLocation=centralus frontendOrigin=https://witty-field-0f855da10.3.azurestaticapps.net \
		sqlAdministratorPassword="$COUNTERPOINT_SQL_ADMIN_PASSWORD" \
		entraClientId="$COUNTERPOINT_ENTRA_CLIENT_ID" \
		entraOpenIdIssuer="$COUNTERPOINT_ENTRA_OPENID_ISSUER"
```

Review every resource and SKU in the preview. For an Azure Free subscription, stop here if the SQL `Basic` tier, Static Web App `Standard` tier, or Functions `FlexConsumption` plan is not covered by the current offer or available quota. Change the relevant module or create a Free-specific parameter/SKU strategy before deploying; do not assume that the subscription label changes the template's pricing tier.

### 9. Deploy the Azure resources

When the preview and cost review are acceptable, run the deployment:

```sh
az deployment group create \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--template-file infrastructure/main.bicep \
	--parameters environment=dev location=eastus2 sqlLocation=centralus frontendOrigin=https://witty-field-0f855da10.3.azurestaticapps.net \
		sqlAdministratorPassword="$COUNTERPOINT_SQL_ADMIN_PASSWORD" \
		entraClientId="$COUNTERPOINT_ENTRA_CLIENT_ID" \
		entraOpenIdIssuer="$COUNTERPOINT_ENTRA_OPENID_ISSUER" \
	--query properties.outputs
```

The deployment is repeatable. It creates or updates the resource set and returns the Function App hostname, Function App name, and Static Web App name. Save the output values for application deployment and Entra redirect URI configuration.

### 10. Configure the frontend redirect URI and build settings

After deployment, retrieve the Static Web App hostname from the Azure portal or deployment output. Add its HTTPS URL to the frontend SPA registration, then build the frontend with the matching Entra values:

```sh
export AZURE_TENANT_ID="$(az account show --query tenantId --output tsv)"
export FRONTEND_APP_ID="$(az ad app list --display-name counterpoint-dev-web --query '[0].appId' --output tsv)"
export API_APP_ID="$(az ad app list --display-name counterpoint-dev-api --query '[0].appId' --output tsv)"

export VITE_CLOUD_API_URL="https://<functions-hostname>.azurewebsites.net"
export VITE_ENTRA_CLIENT_ID="$FRONTEND_APP_ID"
export VITE_ENTRA_TENANT_ID="$AZURE_TENANT_ID"
export VITE_ENTRA_API_CLIENT_ID="$API_APP_ID"

npm install
npm run build
```

Deploy the generated frontend to the Static Web App using the Static Web Apps deployment method configured for the repository.

For a manual CLI deployment, retrieve the deployment token without displaying it, then use the Static Web Apps CLI:

```sh
export STATIC_WEB_APP_NAME="<static-web-app-name-from-deployment-output>"
export SWA_DEPLOYMENT_TOKEN="$(az staticwebapp secrets list \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--name "$STATIC_WEB_APP_NAME" \
	--query properties.apiKey \
	--output tsv)"

npx --yes @azure/static-web-apps-cli deploy ./dist \
	--deployment-token "$SWA_DEPLOYMENT_TOKEN"
unset SWA_DEPLOYMENT_TOKEN
```

The placeholders in this runbook are environment-specific values returned by Azure or created in Entra. Keep deployment tokens and SQL passwords out of shell history, source control, and application logs.

### 11. Grant the Function App access to Key Vault

The current Bicep creates a system-assigned managed identity for the Function App, configures Flex deployment storage, and creates the Storage Blob Data Contributor assignment required for the deployment container. It enables Key Vault RBAC but does not yet create the Key Vault secret-read assignment. After deployment, grant the Function identity permission to read the SQL connection secret:

```sh
export FUNCTIONS_NAME="<functions-name-from-deployment-output>"
export KEY_VAULT_NAME="<key-vault-name-from-deployment-or-portal>"
export FUNCTION_PRINCIPAL_ID="$(az functionapp identity show \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--name "$FUNCTIONS_NAME" \
	--query principalId --output tsv)"
export KEY_VAULT_ID="$(az keyvault show \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--name "$KEY_VAULT_NAME" \
	--query id --output tsv)"

az role assignment create \
	--assignee-object-id "$FUNCTION_PRINCIPAL_ID" \
	--assignee-principal-type ServicePrincipal \
	--role "Key Vault Secrets User" \
	--scope "$KEY_VAULT_ID"
```

The identity needs `Key Vault Secrets User`, not subscription `Owner`. The human or CI identity creating this assignment needs `Owner` or `User Access Administrator` at the vault or resource-group scope. This step must be repeated for each environment, using a different Function App identity and vault. A future Bicep change may automate this assignment; until then, do not treat the initial deployment as complete without it.

### 12. Deploy and verify the Functions backend

Publish the Functions project and deploy it to the Function App name returned by Bicep. GitHub Actions performs this step automatically for the Development workflow; Azure CLI can also be used for a manual deployment.

```sh
export PATH="/opt/homebrew/opt/dotnet@10/bin:$PATH"
dotnet publish backend/CloudApi/CloudApi.csproj \
	--configuration Release \
	--output ./backend/publish

cd backend/publish
zip -r ../cloudapi.zip .
cd ../..

az functionapp deployment source config-zip \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--name "<functions-app-name-from-deployment-output>" \
	--src backend/cloudapi.zip
```

Verify the deployed resources and configuration:

```sh
az resource list \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--output table

az functionapp show \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--name "<functions-app-name-from-deployment-output>" \
	--query defaultHostName \
	--output tsv
```

Complete an Entra sign-in, frontend API call, SQL-backed operation, and role-permission smoke test before treating the environment as usable.

### 10. Free subscription cleanup and monitoring

Free credits and quotas are finite. Monitor usage after deployment and remove the resource group when the development environment is no longer needed:

```sh
az consumption usage list --include-additional-properties true --output table
az resource list --resource-group "$AZURE_RESOURCE_GROUP" --output table
```

To remove all Development resources after testing:

```sh
az group delete --name "$AZURE_RESOURCE_GROUP" --yes --no-wait
```

Do not use the delete command for shared, Staging, or Production resource groups.

## Deployment overview

For executable first-time deployment steps, use the [Azure CLI deployment runbook](#azure-cli-deployment-runbook) above. The repository expects Azure deployment to be driven by infrastructure-as-code and environment secrets, not ad hoc manual configuration.

### 1. Prepare the Azure environment

Before provisioning resources, confirm the following:

- You have an Azure subscription with permission to create resource groups, app services, databases, and identity resources.
- You know the target region, such as `eastus2` or `uksouth`.
- You have an Entra tenant and app registrations ready for the frontend and backend.
- You have a GitHub repository with Azure deployment credentials configured for the target environment.

```sh
az login
az account set --subscription "<your-subscription-id>"

az group create \
	--name rg-counterpoint-dev \
	--location eastus2
```

### 2. Provision infrastructure with Bicep

The repo’s deployment pattern is centered on the Bicep templates in [infrastructure/main.bicep](../../infrastructure/main.bicep) and the environment-specific parameters in [infrastructure/environments/dev.bicepparam](../../infrastructure/environments/dev.bicepparam).

```sh
az deployment group create \
	--resource-group rg-counterpoint-dev \
	--template-file infrastructure/main.bicep \
	--parameters environment=dev location=eastus2 sqlLocation=centralus frontendOrigin=https://witty-field-0f855da10.3.azurestaticapps.net \
		sqlAdministratorPassword="$COUNTERPOINT_SQL_ADMIN_PASSWORD" \
		entraClientId="$COUNTERPOINT_ENTRA_CLIENT_ID" \
		entraOpenIdIssuer="$COUNTERPOINT_ENTRA_OPENID_ISSUER"
```

This creates the shared platform resources required for the app, including:

- Static Web App for the frontend
- Azure Functions for the backend API
- Azure SQL for application data
- Blob Storage for file or asset hosting
- Web PubSub for notifications or live channel events
- Key Vault for secrets and app settings
- Application Insights for diagnostics and telemetry

### 3. Configure application identity and settings

After the infrastructure is created, configure each deployed application with the required values:

- Entra tenant ID
- Frontend client ID and redirect URIs
- Backend API client ID / audience / scope names
- SQL connection string or managed identity configuration
- Key Vault references for sensitive values
- Function app settings for service configuration

Use Key Vault for secrets whenever possible. Avoid hard-coding production credentials in the repository or in local environment files.

### 4. Deploy the frontend and backend

The repo is designed to deploy the frontend and Azure Functions separately:

#### Frontend

- Build the Vite app
- Publish the generated static build to the Azure Static Web App

```sh
npm install
npm run build
```

The deployment pipeline should push the generated static assets to the configured Static Web App endpoint.

#### Backend

- Publish the Functions app from the .NET project
- Ensure the deployment target is the Azure Functions resource created by Bicep

```sh
export PATH="/opt/homebrew/opt/dotnet@10/bin:$PATH"
dotnet build backend/CloudApi/CloudApi.csproj --configuration Release
```

Use GitHub Actions or a deployment task that targets the Functions app resource and injects the required settings from Key Vault or environment variables.

### 5. Run a post-deploy smoke test

After deployment, validate the environment by checking the following:

- The frontend loads without runtime configuration errors.
- Microsoft Entra sign-in succeeds for the intended app registration.
- Backend API calls resolve successfully from the UI.
- Azure SQL is reachable through the application configuration.
- Role-based access behaves correctly in the deployed environment.
- KDS, POS, and operations flows are functioning with the correct permissions.

Recommended checks:

```sh
curl -I "https://<your-static-web-app-hostname>"
curl -I "https://<your-functions-hostname>/api/health"  # if health endpoint is exposed
```

### 6. Production deployment checklist

For Staging or Production, confirm the following before release:

- Environment secrets are rotated and stored in Key Vault or GitHub environment secrets.
- App registrations are correct for the target environment.
- SQL migrations have been applied in order.
- Function app settings are validated after deployment.
- The local development auth bypass is not enabled in the cloud environment.
- Production deployment is protected by approval or an environment protection rule.

### 7. Operational notes

- Prefer the repo’s infra templates and environment parameter files over one-off manual resource creation.
- Treat Azure SQL as the source of truth for transactional data.
- Keep the Functions app thin and move business logic into the domain layer as the repo structure expects.
- Update the specification and wiki together whenever architecture or deployment behavior changes.

This deployment model keeps the system aligned with the architecture defined in the project specification while maintaining a consistent Azure-first rollout process.

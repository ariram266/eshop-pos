# Infrastructure and Deployment

Bicep provisions isolated Development, Staging, and Production resources:

- Static Web Apps
- Functions Flex Consumption
- Azure SQL
- Blob Storage
- Web PubSub
- Key Vault
- Application Insights and Azure Monitor

Secrets are provided by GitHub environment secrets and Key Vault references. Deployments run through GitHub Actions; production requires protected approval.

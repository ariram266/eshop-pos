using '../main.bicep'

param environment = 'dev'
param location = 'eastus'
param sqlAdministratorPassword = readEnvironmentVariable('COUNTERPOINT_SQL_ADMIN_PASSWORD')
param entraClientId = readEnvironmentVariable('COUNTERPOINT_ENTRA_CLIENT_ID')
param entraOpenIdIssuer = readEnvironmentVariable('COUNTERPOINT_ENTRA_OPENID_ISSUER')

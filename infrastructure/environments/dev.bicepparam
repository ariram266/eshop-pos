using '../main.bicep'

param environment = 'dev'
param location = 'eastus2'
param sqlLocation = 'centralus'
param frontendOrigin = 'https://witty-field-0f855da10.3.azurestaticapps.net'
param sqlAdministratorPassword = readEnvironmentVariable('COUNTERPOINT_SQL_ADMIN_PASSWORD')
param entraClientId = readEnvironmentVariable('COUNTERPOINT_ENTRA_CLIENT_ID')
param entraOpenIdIssuer = readEnvironmentVariable('COUNTERPOINT_ENTRA_OPENID_ISSUER')

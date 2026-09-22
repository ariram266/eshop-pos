param environment string = 'dev'
param location string = resourceGroup().location
@secure()
param sqlAdministratorPassword string
param entraClientId string
param entraOpenIdIssuer string

var suffix = toLower(uniqueString(resourceGroup().id, environment))
var prefix = 'counterpoint-${environment}-${take(suffix, 8)}'
var storageName = 'cp${take(suffix, 18)}'

module storage './modules/storage.bicep' = {
  name: '${prefix}-storage'
  params: { name: storageName, location: location }
}

module sql './modules/sql.bicep' = {
  name: '${prefix}-sql'
  params: { name: '${prefix}-sql', location: location, administratorPassword: sqlAdministratorPassword }
}

module insights './modules/app-insights.bicep' = {
  name: '${prefix}-insights'
  params: { name: '${prefix}-insights', location: location }
}

module vault './modules/key-vault.bicep' = {
  name: '${prefix}-vault'
  params: { name: '${prefix}-vault', location: location }
}

module pubsub './modules/web-pubsub.bicep' = {
  name: '${prefix}-pubsub'
  params: { name: '${prefix}-pubsub', location: location }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: vault.outputs.name
}

resource sqlConnectionSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureSqlConnectionString'
  properties: {
    value: 'Server=tcp:${sql.outputs.fullyQualifiedDomainName},1433;Initial Catalog=counterpoint;Persist Security Info=False;User ID=counterpoint;Password=${sqlAdministratorPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
  }
}

module functions './modules/function-app.bicep' = {
  name: '${prefix}-functions'
  params: {
    name: '${prefix}-functions'
    location: location
    storageAccountName: storage.outputs.name
    appInsightsConnectionString: insights.outputs.connectionString
    sqlServerName: sql.outputs.fullyQualifiedDomainName
    keyVaultName: vault.outputs.name
    webPubSubHostName: pubsub.outputs.hostName
    entraClientId: entraClientId
    entraOpenIdIssuer: entraOpenIdIssuer
  }
  dependsOn: [sqlConnectionSecret]
}

module staticWebApp './modules/static-web-app.bicep' = {
  name: '${prefix}-web'
  params: { name: '${prefix}-web' }
}

output functionsHostname string = functions.outputs.hostname
output functionsName string = functions.outputs.name
output staticWebAppName string = staticWebApp.outputs.name

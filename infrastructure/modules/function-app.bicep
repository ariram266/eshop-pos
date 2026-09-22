param name string
param location string
param storageAccountName string
param appInsightsConnectionString string
param sqlServerName string
param keyVaultName string
param webPubSubHostName string
param entraClientId string
param entraOpenIdIssuer string

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${name}-plan'
  location: location
  kind: 'functionapp'
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: name
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'dotnet-isolated' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'AZURE_SQL_SERVER', value: sqlServerName }
        { name: 'AZURE_SQL_DATABASE', value: 'counterpoint' }
        { name: 'AZURE_SQL_CONNECTION_STRING', value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/AzureSqlConnectionString/)' }
        { name: 'WEBPUBSUB_HOST_NAME', value: webPubSubHostName }
        { name: 'AzureWebJobsStorage__accountName', value: storageAccountName }
      ]
    }
  }
}

resource auth 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: app
  name: 'authsettingsV2'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          openIdIssuer: entraOpenIdIssuer
        }
        validation: { allowedAudiences: [entraClientId] }
      }
    }
  }
}

output name string = app.name
output hostname string = app.properties.defaultHostName

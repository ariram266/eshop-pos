param name string
param location string
param storageAccountName string
param storageAccountId string
param storageBlobEndpoint string
param appInsightsConnectionString string
param sqlServerName string
param keyVaultName string
param webPubSubHostName string
param entraClientId string
param entraOpenIdIssuer string
param frontendOrigin string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

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
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageBlobEndpoint}function-deployments'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      runtime: { name: 'dotnet-isolated', version: '10.0' }
      scaleAndConcurrency: { maximumInstanceCount: 40, instanceMemoryMB: 2048 }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      cors: { allowedOrigins: [frontendOrigin] }
      appSettings: [
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

resource storageBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, app.id, 'Storage Blob Data Contributor')
  scope: storageAccount
  properties: {
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
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
        validation: { allowedAudiences: [entraClientId, 'api://${entraClientId}'] }
      }
    }
  }
}

output name string = app.name
output hostname string = app.properties.defaultHostName

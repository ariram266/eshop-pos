param name string
param location string

resource service 'Microsoft.SignalRService/webPubSub@2023-02-01' = {
  name: name
  location: location
  sku: { name: 'Free_F1', tier: 'Free', capacity: 1 }
  properties: { publicNetworkAccess: 'Enabled' }
}

output hostName string = service.properties.hostName

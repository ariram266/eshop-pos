param name string
param location string = 'centralus'

resource app 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  sku: { name: 'Standard' }
  properties: { stagingEnvironmentPolicy: 'Enabled' }
}

output name string = app.name

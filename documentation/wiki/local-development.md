# Local Development

## Prerequisites

Before running Counterpoint locally, install the following tools:

- Node.js 20+
- .NET 10 SDK
- Azure Functions Core Tools v4
- Docker Desktop
- SQL Server / Azure SQL-compatible tooling (`sqlcmd`)
- Git
- Homebrew (macOS)

### macOS setup

```sh
brew update
brew install node dotnet git
brew tap azure/functions
brew trust azure/functions
brew install azure-functions-core-tools@4

brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew trust microsoft/mssql-release
HOMEBREW_ACCEPT_EULA=y brew install mssql-tools18

brew install --cask docker
```

### Verify the environment

```sh
docker info
func --version
node --version
dotnet --list-runtimes
sqlcmd -?
```

### Local auth rule

The app supports a Development-only bypass for local testing. This is allowed only when:

- `AZURE_FUNCTIONS_ENVIRONMENT=Development`
- `COUNTERPOINT_LOCAL_DEV_AUTH=true`

The selected local role is sent using the `X-Local-Dev-Role` header and must never be enabled in Azure, staging, or production. In local Development, the app intentionally requires a role selection on the sign-in screen instead of silently defaulting to `OrganizationOwner`.

## Start services

```sh
docker compose -f docker-compose.local.yml up -d
```

Apply migrations in order, then seed local data:

```sh
for file in database/migrations/00{1,2,3,4,5,6,7,8,9}_*.sql; do
  /opt/homebrew/bin/sqlcmd -S localhost,1433 -U sa -P 'CounterpointDev_123!' -C -d counterpoint -i "$file"
done
/opt/homebrew/bin/sqlcmd -S localhost,1433 -U sa -P 'CounterpointDev_123!' -C -d counterpoint -i database/seeds/001_local_dev.sql
```

Run the API:

```sh
cd backend/CloudApi
func start
```

Run the web app in another terminal:

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` and choose the local role from the sign-in screen before continuing.

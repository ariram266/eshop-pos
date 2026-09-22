# Local Development

## Prerequisites

macOS with Homebrew:

```sh
brew update
brew install node dotnet
brew tap azure/functions
brew trust azure/functions
brew install azure-functions-core-tools@4
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew trust microsoft/mssql-release
HOMEBREW_ACCEPT_EULA=y brew install mssql-tools18
brew install --cask docker
```

Start Docker Desktop, then verify:

```sh
docker info
func --version
node --version
dotnet --list-runtimes
```

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

Open `http://127.0.0.1:5173`. Local settings use a Development-only actor and do not require Entra login. This bypass must never be enabled outside local Development.

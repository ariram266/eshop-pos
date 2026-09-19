# Local Development Setup

This guide explains how to run the Counterpoint POS workspace on macOS and Windows.

## Project services

| Service | Location | Local address |
| --- | --- | --- |
| React POS frontend | repository root | `http://127.0.0.1:5173` |
| Cloud API | `backend/CloudApi` | `http://localhost:5080` |
| Windows POS Agent | `backend/PosAgent` | `http://127.0.0.1:9100` |
| PostgreSQL | Docker | `localhost:5432` |

The Cloud API uses PostgreSQL for Phase 1 data. The POS Agent uses a mock printer adapter until a physical adapter is installed.

## Prerequisites

Install these tools before running the project:

- Git
- Node.js 20 LTS or newer, including npm
- .NET 10 SDK
- Docker Desktop, recommended for PostgreSQL
- A code editor such as VS Code

Verify the installations:

```text
git --version
node --version
npm --version
dotnet --version
docker --version
```

## macOS

### 1. Install tools with Homebrew

Install Homebrew from [brew.sh](https://brew.sh/) if it is not already installed, then run:

```sh
brew update
brew install node dotnet
brew install --cask docker
```

On Apple Silicon Macs, Homebrew is installed under `/opt/homebrew`. If a new terminal reports `zsh: command not found: brew`, add Homebrew to your shell PATH:

```sh
echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
```

Verify that the mapping is active:

```sh
which brew
brew --version
brew doctor
```

Expected output from `which brew` is `/opt/homebrew/bin/brew`. Open a new Terminal window after this setup so future shells load the same PATH automatically.

Open Docker Desktop once so its daemon is running.

If `.NET 10` is not available from the current Homebrew formula, install the SDK from the official [.NET download page](https://dotnet.microsoft.com/download/dotnet/10.0).

### 2. Clone and enter the repository

```sh
git clone <repository-url>
cd eshop-pos
```

For an existing checkout:

```sh
cd /path/to/eshop-pos
git pull
```

### 3. Install frontend dependencies

```sh
npm install
```

### 4. Start PostgreSQL

```sh
docker run --name counterpoint-postgres \
  -e POSTGRES_USER=counterpoint \
  -e POSTGRES_PASSWORD=counterpoint_dev \
  -e POSTGRES_DB=counterpoint \
  -p 5432:5432 \
  -d postgres:16
```

If the container already exists, start it with:

```sh
docker start counterpoint-postgres
```

### 5. Start the Cloud API

In terminal 1:

```sh
dotnet run --project backend/CloudApi
```

The API is available at `http://localhost:5080`.

### 6. Start the local POS Agent

The agent is intended to run only on loopback because it represents local hardware.

In terminal 2:

```sh
dotnet run --project backend/PosAgent
```

The agent is available at `http://127.0.0.1:9100`.

### 7. Start the frontend

In terminal 3:

```sh
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` in a browser.

## Windows

### 1. Install tools

Install:

- [Git for Windows](https://git-scm.com/download/win)
- [Node.js LTS](https://nodejs.org/en/download)
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/download)

Restart VS Code or PowerShell after installing the tools so their PATH entries are available.

Verify from PowerShell:

```powershell
git --version
node --version
npm --version
dotnet --version
docker --version
```

### 2. Clone and enter the repository

```powershell
git clone <repository-url>
cd eshop-pos
```

For an existing checkout:

```powershell
cd C:\path\to\eshop-pos
git pull
```

### 3. Install frontend dependencies

```powershell
npm install
```

### 4. Start PostgreSQL

Make sure Docker Desktop is running, then execute:

```powershell
docker run --name counterpoint-postgres `
  -e POSTGRES_USER=counterpoint `
  -e POSTGRES_PASSWORD=counterpoint_dev `
  -e POSTGRES_DB=counterpoint `
  -p 5432:5432 `
  -d postgres:16
```

If the container already exists:

```powershell
docker start counterpoint-postgres
```

### 5. Start the Cloud API

In PowerShell terminal 1:

```powershell
dotnet run --project backend/CloudApi
```

The API is available at `http://localhost:5080`.

### 6. Start the local POS Agent

Run this on the Windows POS machine. The agent binds to `127.0.0.1` and is therefore not exposed to the network.

In PowerShell terminal 2:

```powershell
dotnet run --project backend/PosAgent
```

The agent is available at `http://127.0.0.1:9100`.

### 7. Start the frontend

In PowerShell terminal 3:

```powershell
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` in a browser.

## Environment variables

The frontend defaults to the local ports above. To override them, create a `.env.local` file in the repository root:

```env
VITE_CLOUD_API_URL=http://localhost:5080
VITE_AGENT_API_URL=http://127.0.0.1:9100
ConnectionStrings__Postgres=Host=localhost;Port=5432;Database=counterpoint;Username=counterpoint;Password=counterpoint_dev
```

Do not commit credentials or production URLs to `.env.local`.

## Smoke checks

With both .NET services running, check the endpoints:

macOS/Linux:

```sh
curl http://localhost:5080/health
curl http://localhost:5080/api/products
curl http://127.0.0.1:9100/health
curl http://127.0.0.1:9100/devices
```

Windows PowerShell:

```powershell
Invoke-RestMethod http://localhost:5080/health
Invoke-RestMethod http://localhost:5080/api/products
Invoke-RestMethod http://127.0.0.1:9100/health
Invoke-RestMethod http://127.0.0.1:9100/devices
```

Validate the frontend production bundle:

```sh
npm run build
```

## Common problems

### `npm` or `node` is not recognized

Install Node.js LTS and restart the terminal. On Windows, confirm the Node.js installation directory is in PATH.

### `dotnet` is not recognized

Install the .NET 10 SDK, not only the ASP.NET runtime, then restart the terminal.

### Port already in use

Find the process using the port, stop it, or change the local URL and matching `VITE_*` variable. The POS Agent must remain loopback-only.

### Docker cannot start PostgreSQL

Open Docker Desktop and wait until it reports that Docker is running. Check the container with:

```sh
docker ps -a
```

### The browser cannot reach the POS Agent

Confirm the agent is running locally and that the browser is using `http://127.0.0.1:9100`, not a LAN IP. The current mock agent does not require authentication, but production deployments must add device authentication.

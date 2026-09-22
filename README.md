# Counterpoint POS

A cloud-first React + TypeScript POS workspace based on the architecture in [specs.md](specs.md).

## Implemented frontend slice

- Responsive checkout workspace for Windows, Android, and iPad-sized screens.
- Local product catalog with category filtering and instant search.
- Cart line editing, tax calculation, customer placeholder, and payment action.
- Browser receipt preview and online status surfaces for cloud checkout.
- PWA manifest and service worker shell for app-like startup.
- Visual language tuned for a fast counter workflow: dense navigation, clear totals, large touch targets, and restrained status feedback.
- Transaction processing is online-only and server-authoritative.
- Backend integration targets Azure Functions and Azure SQL as defined in [specs.md](specs.md).

## Run locally

Install Node.js 20+ first, then run:

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
```

## Service boundaries

The browser calls the cloud API for catalog, inventory, and orders. Receipt preview supports browser Print / Save as PDF and does not require a local agent. The Phase 1 backend contract is documented in [backend/README.md](backend/README.md), with Azure SQL migrations under [database/migrations](database/migrations).

### Azure Static Web Apps

The React app builds to `dist/` and includes [staticwebapp.config.json](staticwebapp.config.json) for SPA fallback. The GitHub Actions workflow at [.github/workflows/azure-static-web-apps.yml](.github/workflows/azure-static-web-apps.yml) deploys `dist/` to Azure Static Web Apps after `npm ci` and `npm run build`. Add the Azure deployment token as the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
# Counterpoint — AI Agent Instructions

This file is auto-loaded as custom instructions for AI coding agents working in this repo. It exists so agents don't need the same context repeated every prompt.

## Source of truth

- `specs.md` is the canonical specification (architecture, phases 0-13, data model, API contracts).
- `documentation/wiki/` mirrors and expands on `specs.md` per topic (architecture, backend-api, database-migrations, infrastructure, testing, phase docs).
- When specs.md changes, treat it as the new baseline — re-read the relevant section before continuing prior work, do not blindly continue a stale plan.

## Spec-sync rule (mandatory)

Whenever you implement, change, or remove a feature:

1. Update `specs.md` and the matching file under `documentation/wiki/` in the same change — not as a follow-up. Add missing sections if the spec is silent on something you just built.
2. If you discover the spec is missing/ambiguous for something you are implementing, add the missing spec text first (data model, API contract, business rule), then implement it.
3. Never leave the docs describing capabilities that don't exist in code, and never leave implemented capabilities undocumented.
4. Keep `documentation/wiki/first-production-milestone.md` accurate about what's actually done vs. still pending for the Phase 0-5 milestone.

## Architecture (locked decisions — do not deviate without explicit user request)

- Frontend: React + TypeScript + Vite, single app, role-aware UI (not route-separated apps).
- Backend: .NET (pinned via `global.json`) Azure Functions isolated worker, modular monolith (not microservices).
- Database: Azure SQL / SQL Server-compatible. Migrations are plain ordered `.sql` files under `database/migrations/NNN_name.sql` — never edit an already-applied migration; add a new one.
- No offline POS, no local POS agent, no SQLite/PostgreSQL, no Redis/Service Bus/Kafka unless the user explicitly asks and updates specs.md accordingly.
- Local dev auth bypass (`COUNTERPOINT_LOCAL_DEV_AUTH`) only in `local.settings.json`, only for `AZURE_FUNCTIONS_ENVIRONMENT=Development`. Never weaken production auth to make local dev easier.

## Repo layout

- `backend/CloudApi` — Functions app (`Functions/*.cs` = thin triggers, `Domain/*.cs` = business/SQL logic, `Infrastructure/*.cs` = cross-cutting).
- `backend/Contracts` — shared request/response DTOs referenced by both `CloudApi` and `CloudApi.Tests`.
- `backend/CloudApi.Tests` — xUnit tests.
- `database/migrations/*.sql` — ordered, additive schema; `database/migrations/README.md` lists what's covered.
- `src/` — React app; `src/lib/api.ts` is the single API client; feature views are separate components composed in `App.tsx`.
- `infrastructure/` — Bicep modules.

## Validation commands (run after backend/frontend changes)

```sh
npm run typecheck
npm test -- --run
npm run build
```

```sh
export PATH="/opt/homebrew/opt/dotnet@10/bin:$PATH"
dotnet build backend/CloudApi/CloudApi.csproj --configuration Release
dotnet test backend/CloudApi.Tests/CloudApi.Tests.csproj --configuration Release
```

```sh
git diff --check
```

Local SQL: `sqlcmd -S localhost,1433 -U sa -P 'CounterpointDev_123!' -C -d counterpoint` (see `LOCAL-SETUP.md`).

## Local Functions host caveat

`func start` serves the build that existed when it started. After changing `backend/CloudApi` source, kill the process on port 7071 and restart `func start`, or you will debug against stale behavior (this has caused false "bugs" before).

## UI conventions

- Single visual accent color (`var(--primary-dark)`) for: header background, primary action buttons, and the active/selected state of any nav/tab/filter control. Keep this consistent — don't introduce a second "selected" color.
- White (`#ffffff`) app background; use `var(--line)` borders and soft shadows (`box-shadow: 0 Npx Npx #17342d0a`-style) for panel separation instead of colored backgrounds.
- Don't create duplicate top-level nav entries for things that already live inside an existing section (e.g., Vendors/Purchases/Reports live inside "Operations", not as separate top-level buttons).

## Implementation discipline

- Prefer additive SQL migrations over destructive ones; guard inventory/quantity updates with a WHERE clause that prevents negative stock, don't just read-then-write.
- Every new endpoint needs: a Contracts DTO, a Domain service method (parameterized SQL, no string-built values), a thin Function trigger, and — per the spec-sync rule above — a specs.md/wiki update.
- Don't scaffold Phase 6+ (customer commerce, farm, purchasing beyond receiving, production, finance) unless asked; keep the milestone scope explicit in code comments/docs when in doubt.

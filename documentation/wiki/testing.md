# Testing and Delivery

Every feature requires a specification, contracts, migrations, server-side rules, tests, documentation, and CI.

Required checks:

- Frontend typecheck, Vitest, build, and Playwright E2E.
- Backend build, unit tests, SQL integration tests, authorization and tenant-isolation tests.
- Migration ordering and application validation.
- Dependency and secret scanning.
- Development smoke tests before staging and protected production deployment.

# Phase 3: Farm, Purchasing, and Production

Phase 3 connects suppliers and farms to the inventory ledger:

`Supplier -> Purchase -> Receipt -> Batch -> Stock movements -> Recipe version -> Production batch -> Prepared inventory`

All receiving, harvest, transfer, waste, consumption, and production output operations are transactional and auditable. Recipe versions are immutable after use so historical production remains understandable.

The implemented operations surface currently supports organization-scoped vendor management and received-purchase entry. A purchase edit reconciles the prior receipt against the replacement line set in one transaction and records compensating `PURCHASE_EDIT` stock movements. Edits are rejected when the prior quantity has already been consumed from inventory.

Role policy is enforced at the UI and API boundary: `OrganizationOwner`, `OperationsManager`, and `StoreManager` get the full operational menus; `Cashier` is limited to POS plus purchase receiving. Cashier access is receive-only; purchase editing remains reserved for the stronger inventory-adjustment permission.

Receiving is limited to products marked for inventory tracking. Raw materials and purchased merchandise are received; prepared products and menu items are produced or assembled from those tracked inputs instead of being received as purchased stock.

# Phase 3: Farm, Purchasing, and Production

Phase 3 connects suppliers and farms to the inventory ledger:

`Supplier -> Purchase -> Receipt -> Batch -> Stock movements -> Recipe version -> Production batch -> Prepared inventory`

All receiving, harvest, transfer, waste, consumption, and production output operations are transactional and auditable. Recipe versions are immutable after use so historical production remains understandable.

The implemented operations surface currently supports organization-scoped vendor management and received-purchase entry. One vendor invoice/reference can contain multiple inventory-tracked product lines, which are received in one transaction. Receiving creates or increments each location inventory balance so the stock is available for POS sales. A purchase edit reconciles the prior receipt against the replacement line set in one transaction and records compensating `PURCHASE_EDIT` stock movements. Edits are rejected when the prior quantity has already been consumed from inventory.

Role policy is enforced at the UI and API boundary: `OrganizationOwner`, `OperationsManager`, and `StoreManager` get the full operational menus and the `inventory.adjust` permission for purchase editing; `Cashier` is limited to POS plus purchase receiving. Cashier access is receive-only.

Receiving is limited to products marked for inventory tracking. The receiving form captures one common vendor and invoice/reference, resolves searchable product results to product IDs in a Product/Qty/Unit Price table, and allows multiple lines on one vendor invoice. Raw materials and purchased merchandise are received; prepared products and menu items are produced or assembled from those tracked inputs instead of being received as purchased stock.

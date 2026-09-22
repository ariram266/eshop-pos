Counterpoint Commerce & POS Platform
====================================

Specification-Driven Development (SDD)
--------------------------------------

### Version 1.0 — Final Baseline

* * *

1. Purpose
==========

Counterpoint is a cloud-first, multi-tenant commerce and operations platform supporting:
*   Farm and produce operations
    
*   Cafe/restaurant operations
    
*   Retail
    
*   Inventory
    
*   Purchasing
    
*   Recipes and production
    
*   POS
    
*   Kitchen Display System (KDS)
    
*   Customer ordering
    
*   Payments
    
*   Reporting
    
*   Future agri-tourism
    
The platform uses a single central domain model and a cloud-authoritative database.
The same React application provides different experiences based on authenticated user role and permissions.

* * *

2. Core Architectural Decisions
===============================

These decisions are considered **locked for v1**.

| Area | Decision |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| Hosting | Azure Static Web Apps |
| Backend | .NET 10 Azure Functions |
| Functions plan | Flex Consumption |
| API | REST/HTTPS |
| Database | Azure SQL Database |
| ORM | Entity Framework Core |
| Real-time | Azure Web PubSub |
| Authentication | Microsoft Entra External ID or equivalent |
| Object storage | Azure Blob Storage |
| Secrets | Azure Key Vault |
| Monitoring | Application Insights + Azure Monitor |
| Infrastructure | Bicep |
| CI/CD | GitHub Actions |
| Architecture | Modular monolith/serverless API |
| Tenancy | Multi-tenant from day one |
| POS | Cloud-first |
| Offline POS | **Not supported** |
| Local POS database | **None** |
| POS Agent | **None** |
| Sync engine | **None** |
| Redis | Not initially |
| Service Bus | Not initially |
| Kafka | Not initially |
| Microservices | Not initially |

Infrastructure must be added only whena measured requirement justifies it.

* * *

3. Architecture
===============

                             INTERNET
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
               Staff                         Customer
                  │                             │
                  └──────────────┬──────────────┘
                                 │
                                HTTPS
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │ Azure Static Web Apps   │
                     │                        │
                     │ React + TypeScript     │
                     │ POS / Admin / KDS      │
                     │ Customer               │
                     └───────────┬────────────┘
                                 │
                              REST/HTTPS
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │ Azure Functions        │
                     │ .NET 10                │
                     │ Flex Consumption       │
                     │                        │
                     │ Business/API Layer     │
                     └───────┬────────┬───────┘
                             │        │
                             ▼        ▼
                     ┌────────────┐ ┌───────────────┐
                     │ Azure SQL  │ │ Web PubSub    │
                     │            │ │               │
                     │ SOURCE OF  │ │ KDS real-time │
                     │ TRUTH      │ │ notifications │
                     └────────────┘ └───────┬───────┘
                                            │
                                 ┌──────────┼──────────┐
                                 ▼          ▼          ▼
                              Kitchen     Juice      Counter
                                KDS        KDS         KDS
    

Supporting services:

    Azure Blob Storage
        ├── Product images
        ├── Documents
        └── Report/receipt exports
    
    Azure Key Vault
        └── Secrets
    
    Application Insights
        ├── Logs
        ├── Metrics
        └── Traces
    
    Microsoft Entra External ID
        └── Authentication
    

* * *

4. Architectural Principles
===========================

4.1 Azure SQL is the source of truth
------------------------------------

    React
      ↓
    Azure Functions
      ↓
    Azure SQL
    

React never connects directly to SQL.

4.2 Server-side business authority
----------------------------------

The API is authoritative for:
*   Pricing
    
*   Discounts
    
*   Taxes
    
*   Inventory
    
*   Orders
    
*   Payments
    
*   Refunds
    
*   Permissions
    
*   Tenant isolation
    
*   Location access
    
*   KDS state
    
*   Booking capacity
    
The client may calculate values for UX but cannot be trusted as the final authority.

4.3 Web PubSub is a notification mechanism
------------------------------------------

    Business transaction
           ↓
    Azure SQL
           ↓
    KDS event
           ↓
    Web PubSub
           ↓
    KDS
    

WebSocket state must never be the source of truth.
If a KDS disconnects:

    KDS reconnects
          ↓
    GET active KDS work
          ↓
    Azure SQL
    

* * *

5. Multi-Tenant Architecture
============================

Every organization-owned entity must include:

    organization_id
    

Entities associated with physical operations additionally include:

    location_id
    

Security flow:

    Authenticated User
           ↓
    Identity
           ↓
    Organization
           ↓
    Roles
           ↓
    Permissions
           ↓
    Allowed Locations
           ↓
    Resource
    

The frontend must never be trusted to determine tenant identity.
The API derives tenant identity from the authenticated identity.

* * *

6. Repository Structure
=======================

    counterpoint/
    │
    ├── apps/
    │   ├── web/
    │   │   ├── pos/
    │   │   ├── kds/
    │   │   ├── admin/
    │   │   ├── customer/
    │   │   └── shared/
    │   │
    │   └── api/
    │
    ├── src/
    │   ├── Domain/
    │   ├── Application/
    │   ├── Infrastructure/
    │   └── Functions/
    │
    ├── tests/
    │   ├── Unit/
    │   ├── Integration/
    │   └── E2E/
    │
    ├── database/
    │   └── migrations/
    │
    ├── infrastructure/
    │   ├── main.bicep
    │   └── modules/
    │
    ├── docs/
    │   ├── architecture/
    │   ├── api/
    │   └── specifications/
    │
    └── .github/
        └── workflows/
    

The backend should remain a **modular monolith** initially.
Modules are logically separated without creating independently deployed microservices.

* * *

7. Technology Standards
=======================

Frontend
--------

*   React
    
*   TypeScript
    
*   Vite
    
*   PWA
    
*   Shared component library
    
*   Central API client
    
*   Route-level authorization
    
*   Server-state caching
    
*   Client-side catalog caching
    

Backend
-------

*   .NET 10
    
*   Azure Functions
    
*   C#
    
*   Entity Framework Core
    
*   Azure SQL
    
*   OpenAPI
    
*   Dependency injection
    
*   Structured logging
    
*   Application Insights
    

Infrastructure
--------------

*   Azure
    
*   Bicep
    
*   Managed identities
    
*   Key Vault
    
*   Environment-specific configuration
    

* * *

8. Application Experiences
==========================

One React application contains:

    /
    ├── /pos
    ├── /kds
    ├── /admin
    ├── /customer
    ├── /orders
    ├── /inventory
    ├── /products
    ├── /reports
    └── /account
    

The UI is role-aware.
Security is always enforced by the API.

* * *

9. Roles
========

Initial roles:

    OrganizationOwner
    OperationsManager
    StoreManager
    Cashier
    KitchenStaff
    Accountant
    Customer
    

Permissions include:

    catalog.read
    catalog.write
    
    inventory.read
    inventory.adjust
    inventory.transfer
    
    orders.create
    orders.read
    orders.cancel
    orders.refund
    
    payments.read
    payments.refund
    
    reports.read
    reports.sales
    reports.inventory
    reports.finance
    
    users.manage
    locations.manage
    devices.manage
    configuration.manage
    

Permissions are scoped by organization and, where required, location.

* * *

10. Data Model
==============

All primary IDs are UUIDs.
Money must use decimal types.
Floating point must not be used for persisted monetary values.
Mutable entities generally contain:

    created_at
    updated_at
    row_version
    

* * *

10.1 Organization
-----------------

    Organization
    ------------
    id
    name
    legal_name
    currency_code
    timezone
    status
    created_at
    updated_at
    

* * *

10.2 User
---------

    User
    ----
    id
    organization_id
    external_identity_id
    name
    email
    phone
    status
    created_at
    updated_at
    

Authentication credentials are not stored by Counterpoint when an external identity provider is used.

* * *

10.3 Role
---------

    Role
    ----
    id
    organization_id
    name
    description
    

10.4 Permission
---------------

    Permission
    ----------
    id
    code
    description
    

10.5 UserRole
-------------

    UserRole
    --------
    user_id
    role_id
    

10.6 RolePermission
-------------------

    RolePermission
    --------------
    role_id
    permission_id
    

* * *

11. Location Model
==================

Location
--------

    Location
    --------
    id
    organization_id
    type
    name
    code
    address_line1
    address_line2
    city
    state
    postal_code
    country
    timezone
    status
    created_at
    updated_at
    

Types:

    FARM
    STORE
    CAFE
    WAREHOUSE
    KITCHEN
    OTHER
    

UserLocation
------------

    UserLocation
    ------------
    user_id
    location_id
    

* * *

12. Register and Device
=======================

Register
--------

    Register
    --------
    id
    organization_id
    location_id
    name
    register_number
    status
    created_at
    updated_at
    

Device
------

    Device
    ------
    id
    organization_id
    location_id
    register_id
    device_type
    name
    status
    last_seen_at
    created_at
    updated_at
    

Device types:

    POS
    KDS
    ADMIN
    MOBILE
    

* * *

13. Catalog
===========

Category
--------

    Category
    --------
    id
    organization_id
    parent_id
    name
    description
    sort_order
    customer_visible
    active
    created_at
    updated_at
    

Supports hierarchical categories.

* * *

Product
-------

    Product
    -------
    id
    organization_id
    sku
    barcode
    HSN
    name
    description
    product_type
    category_id
    unit
    active
    customer_visible
    track_inventory
    tax_category_id
    GST
    CGST
    SGST
    preparation_station_id
    preparation_time_minutes
    origin
    freshness_description
    ingredients
    allergens
    delivery_enabled
    pickup_enabled
    created_at
    updated_at
    row_version
    

Product types:

    STOCKED_PRODUCT
    PREPARED_PRODUCT
    MENU_ITEM
    MERCHANDISE
    SERVICE
    NON_STOCK
    

`SERVICE` allows future tourism features to reuse the commerce model.

* * *

14. Product Pricing
===================

ProductPrice
------------

    ProductPrice
    ------------
    id
    product_id
    location_id
    amount
    currency_code
    tax_code
    valid_from
    valid_to
    active
    

Supports location-specific pricing.

* * *

15. Product Media
=================

    ProductMedia
    ------------
    id
    product_id
    blob_key
    media_type
    alt_text
    sort_order
    created_at
    

Media files are stored in Azure Blob Storage.

* * *

16. Modifiers
=============

ModifierGroup
-------------

    ModifierGroup
    -------------
    id
    organization_id
    name
    selection_type
    min_selections
    max_selections
    active
    

Modifier
--------

    Modifier
    --------
    id
    modifier_group_id
    name
    price_adjustment
    active
    

ProductModifierGroup
--------------------

    ProductModifierGroup
    --------------------
    product_id
    modifier_group_id
    

* * *

17. Preparation Stations
========================

    PreparationStation
    ------------------
    id
    organization_id
    location_id
    name
    station_type
    active
    created_at
    updated_at
    

Examples:

    KITCHEN
    JUICE
    COUNTER
    BAR
    DESSERT
    

* * *

18. Suppliers
=============

    Supplier
    --------
    id
    organization_id
    name
    contact_name
    email
    phone
    address
    status
    created_at
    updated_at
    

* * *

19. Inventory
=============

Batch
-----

    Batch
    -----
    id
    organization_id
    product_id
    lot_number
    origin
    produced_at
    received_at
    expires_at
    freshness_status
    status
    created_at
    updated_at
    

InventoryBalance
----------------

    InventoryBalance
    ----------------
    id
    organization_id
    product_id
    location_id
    batch_id
    on_hand
    reserved
    available
    updated_at
    row_version
    

Business invariant:

    available = on_hand - reserved
    reserved >= 0
    available >= 0
    

Subject to configured inventory policies.

StockMovement
-------------

    StockMovement
    -------------
    id
    organization_id
    product_id
    location_id
    batch_id
    movement_type
    quantity
    unit
    source_type
    source_id
    reason
    actor_id
    created_at
    

Movement types:

    RECEIPT
    SALE
    RESERVATION
    RELEASE
    TRANSFER
    ADJUSTMENT
    WASTE
    EXPIRY
    PRODUCTION_CONSUMPTION
    PRODUCTION_OUTPUT
    

Inventory is changed through business operations that create stock movements.
Direct quantity mutation is not the domain abstraction.

* * *

20. Purchasing
==============

Purchase
--------

    Purchase
    --------
    id
    organization_id
    supplier_id
    location_id
    status
    purchase_date
    subtotal
    tax
    total
    created_at
    updated_at
    

PurchaseLine
------------

    PurchaseLine
    ------------
    id
    purchase_id
    product_id
    quantity
    unit
    unit_cost
    tax
    line_total
    batch_id
    

Statuses:

    DRAFT
    RECEIVED
    PARTIALLY_RECEIVED
    CANCELLED
    

* * *

21. Recipes
===========

Recipe
------

    Recipe
    ------
    id
    organization_id
    output_product_id
    name
    version
    active
    created_at
    updated_at
    

RecipeIngredient
----------------

    RecipeIngredient
    ---------------
    id
    recipe_id
    input_product_id
    quantity
    unit
    

Recipe versions become historical references once used by production.

* * *

22. Production
==============

ProductionBatch
---------------

    ProductionBatch
    ---------------
    id
    organization_id
    recipe_id
    location_id
    quantity_produced
    unit
    produced_at
    expires_at
    status
    created_by
    created_at
    updated_at
    

Production:

    Raw Inventory
          ↓
    Consume ingredients
          ↓
    Production Batch
          ↓
    Finished Inventory
    

* * *

23. Customer
============

Customer
--------

    Customer
    --------
    id
    organization_id
    name
    email
    phone
    status
    created_at
    updated_at
    

CustomerAddress
---------------

    CustomerAddress
    ---------------
    id
    customer_id
    type
    address_line1
    address_line2
    city
    state
    postal_code
    country
    is_default
    

* * *

24. Orders
==========

Order
-----

    Order
    -----
    id
    organization_id
    location_id
    register_id
    customer_id
    order_number
    channel
    order_type
    status
    subtotal
    discount_total
    tax_total
    total
    currency_code
    special_instructions
    scheduled_at
    created_at
    updated_at
    row_version
    

Channels:

    POS
    CUSTOMER_WEB
    CUSTOMER_MOBILE
    ADMIN
    

Order types:

    DINE_IN
    TAKEAWAY
    PICKUP
    DELIVERY
    INTERNAL
    

* * *

25. Order Lines
===============

    OrderLine
    ---------
    id
    order_id
    product_id
    product_name_snapshot
    sku_snapshot
    quantity
    unit_price
    discount
    tax
    line_total
    snapshot_json
    created_at
    

Historical product information is stored as a snapshot.

OrderLineModifier
-----------------

    OrderLineModifier
    -----------------
    id
    order_line_id
    modifier_id
    modifier_name_snapshot
    price_adjustment
    

* * *

26. Order Lifecycle
===================

Primary states:

    DRAFT
    SUBMITTED
    ACCEPTED
    PREPARING
    READY
    COMPLETED
    CANCELLED
    

Payment state is separate.
Customer-specific operational states may include:

    PAYMENT_PENDING
    PAYMENT_FAILED
    OUT_FOR_DELIVERY
    

* * *

27. Payments
============

    Payment
    -------
    id
    organization_id
    order_id
    method
    status
    amount
    currency_code
    provider
    provider_reference
    paid_at
    created_at
    updated_at
    

Statuses:

    PENDING
    AUTHORIZED
    PAID
    FAILED
    PARTIALLY_REFUNDED
    REFUNDED
    

Card data is never stored by Counterpoint.

* * *

28. Refunds
===========

    Refund
    ------
    id
    payment_id
    order_id
    amount
    reason
    provider_reference
    status
    created_at
    created_by
    

Refunds are separate financial events.

* * *

29. KDS
=======

KdsOrder
--------

    KdsOrder
    --------
    id
    order_id
    station_id
    status
    created_at
    accepted_at
    ready_at
    completed_at
    

KdsOrderItem
------------

    KdsOrderItem
    ------------
    id
    kds_order_id
    order_line_id
    quantity
    status
    created_at
    updated_at
    

Statuses:

    QUEUED
    ACCEPTED
    PREPARING
    READY
    COMPLETED
    CANCELLED
    

* * *

30. Accounting
==============

    AccountingTransaction
    ---------------------
    id
    organization_id
    order_id
    purchase_id
    transaction_type
    amount
    tax
    currency_code
    ledger_code
    description
    created_at
    

The first release does not attempt to replace a complete accounting package.

* * *

31. Audit
=========

    AuditEvent
    ----------
    id
    organization_id
    actor_id
    action
    entity_type
    entity_id
    before_json
    after_json
    ip_address
    created_at
    

Required for privileged operations.

* * *

32. Future Booking
==================

Schedule
--------

    Schedule
    --------
    id
    organization_id
    service_product_id
    start_at
    end_at
    capacity
    status
    assigned_guide_id
    

Booking
-------

    Booking
    -------
    id
    organization_id
    service_product_id
    schedule_id
    customer_id
    quantity
    status
    payment_id
    customer_notes
    created_at
    updated_at
    

Booking capacity must be transactionally protected.

* * *

33. API Specification
=====================

Authentication
--------------

    GET  /api/auth/me
    POST /api/auth/refresh
    POST /api/auth/logout
    

POS Bootstrap
-------------

    GET /api/pos/bootstrap
    

Returns:

    {
      "catalogVersion": 42,
      "categories": [],
      "products": [],
      "prices": [],
      "modifiers": [],
      "taxRules": [],
      "stations": []
    }
    

The bootstrap endpoint exists to avoid unnecessary API calls during normal POS usage.

* * *

34. Catalog API
===============

    GET    /api/products
    POST   /api/products
    GET    /api/products/{id}
    PATCH  /api/products/{id}
    
    GET    /api/categories
    POST   /api/categories
    PATCH  /api/categories/{id}
    
    GET    /api/modifiers
    POST   /api/modifiers
    
    GET    /api/prices
    POST   /api/prices
    

* * *

35. Location API
================

    GET  /api/locations
    POST /api/locations
    
    GET  /api/registers
    POST /api/registers
    
    GET  /api/devices
    POST /api/devices
    

* * *

36. Inventory API
=================

    GET  /api/inventory
    GET  /api/stock-movements
    POST /api/stock-movements
    
    GET  /api/batches
    POST /api/batches
    
    GET  /api/purchases
    POST /api/purchases
    
    GET  /api/production-batches
    POST /api/production-batches
    

* * *

37. Order API
=============

    POST /api/orders
    GET  /api/orders
    GET  /api/orders/{id}
    
    POST /api/orders/{id}/pay
    POST /api/orders/{id}/status
    POST /api/orders/{id}/cancel
    POST /api/orders/{id}/refund
    

* * *

38. KDS API
===========

    GET  /api/kds/orders/active
    GET  /api/kds/orders/{id}
    
    POST /api/kds/orders/{id}/accept
    POST /api/kds/orders/{id}/ready
    POST /api/kds/orders/{id}/complete
    

* * *

39. Customer API
================

    GET  /api/customer/profile
    PATCH /api/customer/profile
    
    GET  /api/customer/addresses
    POST /api/customer/addresses
    
    GET  /api/customer/orders
    GET  /api/customer/orders/{id}
    
    POST /api/customer/orders
    

Customer endpoints expose only customer-safe data.

* * *

40. Reporting API
=================

    GET /api/reports/sales
    GET /api/reports/inventory
    GET /api/reports/production
    GET /api/reports/farm-yield
    GET /api/reports/margins
    

* * *

41. Idempotency
===============

Business operations that can be retried must support idempotency.
Examples:

    POST /api/orders
    Idempotency-Key: <unique-key>
    

Required for:
*   Order creation
    
*   Payment creation
    
*   Refunds
    
*   Stock operations
    
*   Booking creation
    
Repeated requests must not create duplicatebusiness transactions.

* * *

42. Transaction Rules
=====================

Critical business operations must be transactional.
Example checkout:

    BEGIN TRANSACTION
    
    Validate tenant
    Validate permissions
    Validate product
    Validate price
    Validate tax
    Validate inventory
    
    Create Order
    Create OrderLines
    Create Payment
    Create StockMovements
    Create KDS Work
    
    COMMIT
    

Failure:

    ROLLBACK
    

No partially completed checkout.

* * *

43. Inventory Concurrency
=========================

Example:

    Available stock = 1
    
    POS A → attempts sale
    POS B → attempts sale
    

Only one transaction can successfully consume the final available unit.
Concurrency tests are mandatory.

* * *

44. POS Specification
=====================

POS route:

    /pos
    

UI:

    POS
    ├── Categories
    ├── Product Search
    ├── Product Grid
    ├── Cart
    ├── Modifiers
    ├── Customer
    ├── Discount
    ├── Tax
    ├── Payment
    └── Receipt
    

Startup:

    GET /api/pos/bootstrap
    

Catalog may be cached locally by the browser for performance.
Inventory remains server authoritative.

### Important

There is **no offline transaction queue**.
If the application loses connectivity, new business transactions cannot be committed until connectivity is restored.

* * *

45. Receipt
===========

Initial implementation:

    POS
     ↓
    Receipt Component
     ↓
    Browser Print
     ↓
    Printer
    

No local printing agent is required for the initial release.
Future direct thermal printing can be added as an isolated hardware integration.

* * *

46. KDS Real-Time Architecture
==============================

    Order
      ↓
    Transaction
      ↓
    KDS Work
      ↓
    Azure SQL
      ↓
    Web PubSub
      ↓
    KDS
    

Example:

    Order #1052
    
    Burger       → Kitchen
    Fries        → Kitchen
    Mango Juice  → Juice
    

The KDS receives only the work relevant to its station.
If an event is missed:

    KDS reconnect
          ↓
    GET /api/kds/orders/active
          ↓
    SQL
    

* * *

47. Customer Commerce
=====================

Customer flow:

    Browse
      ↓
    Product
      ↓
    Cart
      ↓
    Checkout
      ↓
    Payment
      ↓
    Order
      ↓
    KDS
      ↓
    Ready / Delivery
      ↓
    Completed
    

Customers must never receive:
*   Supplier costs
    
*   Internal notes
    
*   Internal inventory levels
    
*   Internal margins
    
*   Internal accounting information
    
*   Internal operational metadata
    

* * *

48. Security
============

Mandatory:
*   HTTPS outside local development
    
*   Server-side RBAC
    
*   Tenant isolation
    
*   Location authorization
    
*   Input validation
    
*   Rate limiting
    
*   Secure session/token handling
    
*   Managed secrets
    
*   Audit logging
    
*   Payment-data isolation
    
*   Least-privilege identities
    
*   Restricted CORS
    
*   Security headers
    
Every resource access must verify organization ownership.

* * *

49. Observability
=================

Structured logs contain relevant context:

    correlation_id
    organization_id
    user_id
    location_id
    device_id
    register_id
    order_id
    

Metrics:

    API latency
    API errors
    Database latency
    Order failures
    Payment failures
    Inventory conflicts
    KDS connection status
    KDS processing time
    

Alerts:

    API outage
    Database failure
    High error rate
    Payment failures
    KDS failures
    

* * *

50. Testing Strategy
====================

Frontend
--------

Test:
*   POS calculations
    
*   Cart
    
*   Discounts
    
*   Tax
    
*   Catalog search
    
*   Permissions
    
*   Customer ordering
    
*   KDS UI
    
*   Error states
    
*   Loading states
    

Backend
-------

Test:
*   Pricing
    
*   Tax
    
*   Inventory
    
*   Inventory concurrency
    
*   Recipes
    
*   Production
    
*   Orders
    
*   Payments
    
*   Refunds
    
*   Authorization
    
*   Tenant isolation
    
*   Location isolation
    
*   Idempotency
    

Integration
-----------

Test:

    API
     ↓
    Application
     ↓
    EF Core
     ↓
    Azure SQL-compatible test database
    

E2E
---

At minimum:

    Admin creates product
            ↓
    POS loads catalog
            ↓
    Cashier creates order
            ↓
    Payment
            ↓
    Inventory deduction
            ↓
    KDS routing
            ↓
    KDS completion
            ↓
    Receipt
    

Customer:

    Customer
     ↓
    Browse
     ↓
    Order
     ↓
    Payment
     ↓
    KDS
     ↓
    Fulfillment
     ↓
    Completed
    

* * *

51. CI/CD
=========

Pull Request
------------

    Checkout
     ↓
    Install dependencies
     ↓
    Frontend typecheck
     ↓
    Frontend lint
     ↓
    Frontend tests
     ↓
    Frontend build
     ↓
    .NET restore
     ↓
    .NET format/check
     ↓
    .NET unit tests
     ↓
    Integration tests
     ↓
    Dependency scan
     ↓
    Secret scan
     ↓
    Build artifacts
    

Failures block merge.

Main Branch
-----------

    Build immutable artifacts
            ↓
    Deploy Development
            ↓
    Database migration
            ↓
    Smoke tests
            ↓
    Health verification
    

Production
----------

    Development
         ↓
    Staging
         ↓
    Approval
         ↓
    Database migration
         ↓
    Application deployment
         ↓
    Smoke tests
         ↓
    Monitoring
    

Application rollback is permitted.
Destructive database migrations must never be automatically rolled back.

* * *

52. Infrastructure as Code
==========================

All Azure infrastructure must be provisionablefrom Bicep.

    infrastructure/
    ├── main.bicep
    └── modules/
        ├── static-web-app.bicep
        ├── functions.bicep
        ├── sql.bicep
        ├── storage.bicep
        ├── keyvault.bicep
        ├── appinsights.bicep
        └── webpubsub.bicep
    

Environment configuration:

    Local
    Development
    Staging
    Production
    

No environment-specific infrastructure should exist only through manual portal configuration.

* * *

53. Phase-Wise Implementation Plan
==================================

Phase 0 — Foundation & Architecture
===================================

### Goal

Establish the platform skeleton and development standards.

### Backend

Implement:
*   .NET 10 Azure Functions
    
*   Modular architecture
    
*   Domain layer
    
*   Application layer
    
*   Infrastructure layer
    
*   Functions/API layer
    
*   EF Core
    
*   Azure SQL configuration
    
*   Migration strategy
    
*   Entity IDs
    
*   Tenant context
    
*   Location context
    
*   Validation
    
*   Error handling
    
*   Logging
    
*   Correlation IDs
    
*   OpenAPI
    
*   `/health`
    

### Frontend

Implement:
*   React
    
*   TypeScript
    
*   Vite
    
*   Application shell
    
*   Routing
    
*   Authentication integration
    
*   Shared UI/design system
    
*   API client
    
*   Global error handling
    
*   Loading states
    
*   Error states
    

### Azure

Provision:
*   Static Web Apps
    
*   Functions Flex Consumption
    
*   Azure SQL
    
*   Storage
    
*   Key Vault
    
*   Application Insights
    
*   Web PubSub
    

### DevOps

Implement:
*   GitHub repository
    
*   Branch protection
    
*   PR pipeline
    
*   Main pipeline
    
*   Environment configuration
    
*   Database migration process
    
*   Bicep deployment
    

### Exit criteria

    Developer
       ↓
    git clone
       ↓
    Run application
       ↓
    React + API + SQL
       ↓
    Authenticated request
       ↓
    Azure deployment
    

All environments can be provisioned from code.

* * *

Phase 1 — Identity, Tenant & Location
=====================================

### Goal

Establish security and organizational foundations.

### Implement

*   Organizations
    
*   Users
    
*   Roles
    
*   Permissions
    
*   Locations
    
*   Registers
    
*   Devices
    
*   User-location assignments
    
*   Tenant context
    
*   Location context
    
*   Authorization policies
    
Roles:

    OrganizationOwner
    OperationsManager
    StoreManager
    Cashier
    KitchenStaff
    Accountant
    Customer
    

### Critical security rule

Never accept:

    organizationId
    

from the client as the security authority.
The API derives organization identity fromthe authenticated identity.

### Exit criteria

    User
     ↓
    Organization
     ↓
    Roles
     ↓
    Locations
     ↓
    Permissions
    

Tenant A cannot access Tenant B.

* * *

Phase 2 — Catalog & Product Management
======================================

### Goal

Create the central product model used by POS, customer commerce, inventory and future tourism.

### Implement

*   Categories
    
*   Subcategories
    
*   Products
    
*   Product types
    
*   SKU
    
*   Barcode
    
*   Units
    
*   Product media
    
*   Modifiers
    
*   Modifier groups
    
*   Tax categories
    
*   Prices
    
*   Location-specific prices
    
*   Availability
    
*   Preparation stations
    

### POS bootstrap

    GET /api/pos/bootstrap
    

### Exit criteria

Admin configures products and prices.
POS loads the required catalog throughone bootstrap request.

* * *

Phase 3 — Core Inventory
========================

### Goal

Establish authoritative stock management.

### Implement

*   Inventory balances
    
*   Stock movements
    
*   Locations
    
*   Batches
    
*   Receiving
    
*   Adjustments
    
*   Transfers
    
*   Waste
    
*   Expiration
    
*   Reservations
    
*   Low-stock thresholds
    

### Critical rule

Do not use:

    UPDATE Inventory
    SET Quantity = Quantity - 1
    

as the business abstraction.
Instead:

    Business operation
           ↓
    Stock movement
           ↓
    Transactional inventory update
    

### Concurrency

Test simultaneous sales against limited stock.

### Exit criteria

Inventory is auditable and concurrent transactions cannot incorrectly oversell stock.

* * *

Phase 4 — POS & Orders
======================

### Goal

Deliver the first real Counterpoint operational workflow.

### POS

    POS
    ├── Product search
    ├── Categories
    ├── Cart
    ├── Modifiers
    ├── Customer
    ├── Discounts
    ├── Tax
    ├── Payment
    └── Receipt
    

### Backend

    POST /api/orders
    GET /api/orders/{id}
    POST /api/orders/{id}/pay
    POST /api/orders/{id}/status
    POST /api/orders/{id}/cancel
    POST /api/orders/{id}/refund
    

### Server calculation

    Subtotal
     - Discount
     + Tax
     = Total
    

Server is authoritative.

### Transaction

Coordinate, as applicable:

    Order
    Order Lines
    Inventory
    Payment
    KDS Work
    

### Receipt

    POS
     ↓
    Receipt component
     ↓
    Browser print
    

### Explicitly excluded

    Offline sales
    Offline queue
    SQLite
    POS sync
    Local POS agent
    

### Exit criteria

    Login
     ↓
    Open POS
     ↓
    Select product
     ↓
    Create order
     ↓
    Take payment
     ↓
    Inventory decreases
     ↓
    Receipt prints
    

* * *

Phase 5 — KDS & Real-Time Operations
====================================

### Goal

Make the restaurant operationally useful.

### Implement

*   Preparation stations
    
*   KDS work items
    
*   Station routing
    
*   KDS screen
    
*   Order acceptance
    
*   Preparing
    
*   Ready
    
*   Completed
    
*   Web PubSub
    
*   Reconnection
    
*   API recovery
    

### Example

    Order
    ├── Burger → Kitchen
    ├── Fries → Kitchen
    └── Mango Juice → Juice
    

### Reliability

    SQL
     ↓
    Persistent state
     ↓
    Web PubSub
     ↓
    KDS notification
    

Recovery:

    KDS
     ↓
    GET /api/kds/orders/active
     ↓
    SQL
    

### Exit criteria

Multiple KDS tablets can operate simultaneouslyand recover current work after reconnecting.

* * *

Production Milestone
====================

At the completion of Phase 5:

    Catalog
       ↓
    POS
       ↓
    Order
       ↓
    Payment
       ↓
    Inventory
       ↓
    KDS
       ↓
    Receipt
    

This represents the **first complete production-capable restaurant workflow**.

* * *

Phase 6 — Customer Commerce
===========================

### Goal

Reuse the same commerce primitives for customers.

### Implement

*   Customer authentication
    
*   Customer profile
    
*   Addresses
    
*   Customer catalog
    
*   Images
    
*   Availability
    
*   Cart
    
*   Pickup
    
*   Delivery
    
*   Special instructions
    
*   Customer order tracking
    
*   Notifications foundation
    

### Exit criteria

Customer and staff use the same underlying order model without duplicating business logic.

* * *

Phase 7 — Farm & Purchasing
===========================

### Goal

Connect agricultural and supplier operations to inventory.

### Farm

Implement:
*   Farms
    
*   Crops
    
*   Livestock
    
*   Harvests
    
*   Production records
    
*   Batch/lot
    
*   Storage
    
*   Expiration
    
*   Freshness
    

### Purchasing

Implement:
*   Suppliers
    
*   Purchase orders
    
*   Purchase lines
    
*   Receiving
    
*   Partial receiving
    
*   Purchase costs
    
*   Batch assignment
    

### Flow

    Farm Harvest ───────┐
                        │
    Supplier Purchase ──┤
                        ↓
                    Inventory
                        ↓
                       POS
    

### Exit criteria

Inventory can be traced to farm harvest or supplier purchase.

* * *

Phase 8 — Recipes & Production
==============================

### Goal

Support prepared foods and cafe production.

### Implement

*   Recipes
    
*   Recipe versions
    
*   Ingredients
    
*   BOM
    
*   Production batches
    
*   Ingredient consumption
    
*   Finished product output
    
*   Expiration
    
*   Production costing
    
Example:

    Recipe: Vada
    
    Lentils    5 kg
    Spices     0.2 kg
    Oil        1 L
    
    Output
    100 Vadas
    

### Critical rule

Historical production references the exact recipe version used.

### Exit criteria

Staff can produce prepared inventory and sell it through the existing POS.

* * *

Phase 9 — Finance & Payments
============================

### Goal

Move from recorded payment references to production-grade financial workflows.

### Implement

*   Payment provider
    
*   Payment intents
    
*   Payment confirmation
    
*   Refunds
    
*   Partial refunds
    
*   Reconciliation
    
*   Tax records
    
*   COGS
    
*   Margin
    
*   Accounting transactions
    
*   Expenses
    
*   Financial exports
    

### Architecture

    POS
     ↓
    Counterpoint API
     ↓
    Payment Provider
     ↓
    Provider Result
     ↓
    Counterpoint Payment
    

Counterpoint stores the provider reference, never card data.

### Exit criteria

    Order
     ↓
    Payment
     ↓
    Provider Reference
     ↓
    Refund
     ↓
    Accounting Transaction
    

is fully traceable.

* * *

Phase 10 — Reporting & Operational Intelligence
===============================================

### Goal

Provide management visibility.

### Sales

*   Daily sales
    
*   Location
    
*   Register
    
*   Product
    
*   Category
    
*   Channel
    
*   Payment method
    
*   Tax
    

### Inventory

*   Stock
    
*   Movements
    
*   Waste
    
*   Expiry
    
*   Transfers
    
*   Valuation
    
*   Low stock
    

### Production

*   Farm yield
    
*   Production quantity
    
*   Ingredient consumption
    
*   Production cost
    

### Restaurant

*   Open orders
    
*   Preparation times
    
*   KDS throughput
    
*   Completion time
    

### Export

Initial:

    CSV
    

PDF can follow later.

* * *

Phase 11 — Multi-Location Hardening
===================================

The tenant/location model already existsfrom Phase 1.
This phase hardens it for serious SaaS usage.

### Implement

*   Location-specific pricing
    
*   Location inventory
    
*   Register management
    
*   Device management
    
*   Transfers
    
*   Location catalog availability
    
*   Location configuration
    
*   Manager scopes
    
*   Cross-location reporting
    
Example:

    Organization
    │
    ├── Store
    │   ├── Inventory
    │   ├── Register 1
    │   └── Register 2
    │
    ├── Cafe
    │   └── Register 1
    │
    └── Farm
        └── Production
    

### Exit criteria

Each location can operate independently whilethe organization retains consolidated visibility.

* * *

Phase 12 — Agri-Tourism
=======================

### Goal

Add experiences without creating a separatecommerce platform.

### Implement

*   Service products
    
*   Events
    
*   Tours
    
*   Workshops
    
*   Schedules
    
*   Capacity
    
*   Guides
    
*   Bookings
    
*   Booking status
    
*   Booking payment
    
*   Cancellation
    
Flow:

    Service Product
          ↓
    Schedule
          ↓
    Capacity
          ↓
    Booking
          ↓
    Payment
    

The booking model reuses:
*   Customer
    
*   Product
    
*   Payment
    
*   Organization
    
*   Location
    

* * *

Phase 13 — Advanced SaaS
========================

Only after actual production usage.
Potential features:
*   Loyalty
    
*   Promotions
    
*   Coupons
    
*   Gift cards
    
*   Subscriptions
    
*   Delivery integrations
    
*   Advanced notifications
    
*   Demand forecasting
    
*   Advanced inventory planning
    
*   Advanced analytics
    
*   External accounting integrations
    
*   Additional payment providers
    
*   Customer marketing
    
*   Advanced farm analytics
    
Infrastructure such as Redis, Service Bus, event streaming or microservices should only be introduced when actual requirements justify them.

* * *

54. SDD Feature Development Process
===================================

Every individual feature follows:

    Feature Specification
            ↓
    Acceptance Criteria
            ↓
    Data Model
            ↓
    Migration
            ↓
    API Contract
            ↓
    Authorization
            ↓
    Backend
            ↓
    Frontend
            ↓
    Tests
            ↓
    Observability
            ↓
    CI
            ↓
    Deployment
    

No feature is considered complete merelybecause the UI works.

* * *

55. Feature Specification Template
==================================

Every feature document must contain:

    # Feature: <Name>
    
    ## Goal
    
    ## Actors
    
    ## Preconditions
    
    ## User Stories
    
    ## Functional Requirements
    
    ## Business Rules
    
    ## Data Model
    
    ## Database Changes
    
    ## API Contract
    
    ## Authorization
    
    ## UI Requirements
    
    ## Validation
    
    ## Error Handling
    
    ## Transactions
    
    ## Concurrency
    
    ## Audit
    
    ## Events / Real-Time
    
    ## Tests
    
    ## Acceptance Criteria
    
    ## Exit Criteria
    
    ## Explicitly Not Included
    

* * *

56. Definition of Done
======================

A feature is complete only when:
*   Domain model is defined.
    
*   Database migration exists.
    
*   API contract is defined.
    
*   Authorization is defined.
    
*   Tenant scope is defined.
    
*   Location scope is defined where applicable.
    
*   Business rules are implemented.
    
*   Validation exists.
    
*   Error behavior is defined.
    
*   Transaction behavior is defined.
    
*   Concurrency behavior is defined where applicable.
    
*   Audit requirements are implemented.
    
*   Frontend is implemented.
    
*   Unit tests pass.
    
*   Integration tests pass.
    
*   E2E tests cover critical workflows.
    
*   Logging/metrics are implemented.
    
*   OpenAPI is updated.
    
*   CI passes.
    
*   Deployment succeeds.
    
*   Documentation is updated.
    

* * *

57. Final Delivery Order
========================

    PHASE 0
    Foundation
          ↓
    PHASE 1
    Identity / Tenant / Location
          ↓
    PHASE 2
    Catalog
          ↓
    PHASE 3
    Inventory
          ↓
    PHASE 4
    POS + Orders
          ↓
    PHASE 5
    KDS + Web PubSub
          ↓
    ════════════════════════════
    FIRST PRODUCTION MILESTONE
    ════════════════════════════
          ↓
    PHASE 6
    Customer Commerce
          ↓
    PHASE 7
    Farm + Purchasing
          ↓
    PHASE 8
    Recipes + Production
          ↓
    PHASE 9
    Payments + Finance
          ↓
    PHASE 10
    Reporting
          ↓
    PHASE 11
    Multi-Location Hardening
          ↓
    PHASE 12
    Agri-Tourism
          ↓
    PHASE 13
    Advanced SaaS
    

58. Final Architecture Summary
==============================

The implementation baseline is therefore:

                      React + TypeScript
                             │
                             │ HTTPS
                             ▼
                   Azure Static Web Apps
                             │
                             │ REST
                             ▼
                    .NET 10 Azure Functions
                      Flex Consumption
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
            Azure SQL              Web PubSub
            SOURCE OF                 REAL-TIME
             TRUTH                     EVENTS
                  │                     │
                  │                ┌────┼────┐
                  │                ▼    ▼    ▼
                  │              KDS  KDS  KDS
                  │
                  ├── Catalog
                  ├── Inventory
                  ├── Orders
                  ├── Payments
                  ├── Customers
                  ├── Farm
                  ├── Purchasing
                  ├── Production
                  └── Accounting
    

The central architectural rule is:

> **Keep Counterpoint as a simple cloud-first modular SaaS platform. Azure SQL is the source of truth, Azure Functions is thebusiness layer, React is the applicationlayer, and Web PubSub provides real-time notifications. Add infrastructure only when real usage demonstrates the need.**
# Database Migrations

Azure SQL migrations are ordered scripts under `database/migrations`.

- `001_foundation.sql`: organizations, users, roles, locations, registers
- `002_catalog.sql`: categories, products, prices, taxes, modifiers, stations
- `003_inventory.sql`: balances and stock ledger
- `004_orders.sql`: orders and idempotency
- `005_payments.sql`: payments and state history
- `006_kds.sql`: KDS work and history
- `007_customer-commerce.sql`: customers, media, delivery and customer order access
- `008_purchasing.sql`: suppliers, purchases, receipts and batches
- `009_farm-production.sql`: farms, harvests, recipes, production and traceability
- `010_catalog-tax.sql`: HSN, GST, computed CGST and SGST product fields
- `011_product-inventory-tracking.sql`: explicit product inventory tracking and type-based backfill
- `012_category-hierarchy.sql`: optional parent categories for department/subcategory organization
- `013_cashier-purchase-permission.sql`: dedicated Cashier purchase-receiving permission
- `014_operations-purchase-permission.sql`: purchase-receiving permission for OrganizationOwner, OperationsManager, and StoreManager

Migrations must be applied in filename order. The application does not mutate schema at startup.

## Apply to the deployed Azure SQL database

After Bicep creates the database and the SQL server firewall allows your current IP, run the migrations from the repository root. Keep the administrator password in an environment variable and do not put it in a script or commit it:

```sh
export SQL_SERVER_NAME="$(az sql server list \
	--resource-group "$AZURE_RESOURCE_GROUP" \
	--query '[0].name' \
	--output tsv)"
read -s COUNTERPOINT_SQL_ADMIN_PASSWORD
export COUNTERPOINT_SQL_ADMIN_PASSWORD

for file in database/migrations/*.sql; do
	/opt/homebrew/bin/sqlcmd \
		-S "${SQL_SERVER_NAME}.database.windows.net" \
		-d counterpoint \
		-U counterpoint \
		-P "$COUNTERPOINT_SQL_ADMIN_PASSWORD" \
		-C -b -i "$file" || exit 1
done
```

The `*.sql` expansion applies the files in numeric filename order (`001` through `014`). Do not run `database/seeds/001_local_dev.sql` against Azure; it creates local-development IDs and data. After migrations, provision the deployed Entra user in `Users`, `UserLocations`, and `UserRoles`.

## Provision Entra users and application roles

Entra authenticates users; Counterpoint SQL assigns application access. Use the Entra user's **Object ID** as `Users.ExternalSubject`, not an email address, tenant ID, subscription ID, or app client ID. Find it in **Microsoft Entra ID > Users > user > Overview > Object ID**.

First find the database IDs in Query Editor:

```sql
SELECT Id, Name FROM Organizations;
SELECT Id, OrganizationId, Name FROM Locations;
SELECT Id, Name FROM Roles WHERE Name IN ('OrganizationOwner', 'Cashier');
```

Replace the four placeholders below and run this in the `counterpoint` database. It is safe to rerun:

```sql
DECLARE @adminObjectId nvarchar(200) = '<ADMIN_ENTRA_OBJECT_ID>';
DECLARE @cashierObjectId nvarchar(200) = '<CASHIER_ENTRA_OBJECT_ID>';
DECLARE @organizationId uniqueidentifier = '<ORGANIZATION_ID>';
DECLARE @locationId uniqueidentifier = '<LOCATION_ID>';
DECLARE @adminUserId uniqueidentifier, @cashierUserId uniqueidentifier;
DECLARE @ownerRoleId uniqueidentifier, @cashierRoleId uniqueidentifier;

SELECT @ownerRoleId = Id FROM Roles WHERE Name = 'OrganizationOwner';
SELECT @cashierRoleId = Id FROM Roles WHERE Name = 'Cashier';
IF @ownerRoleId IS NULL OR @cashierRoleId IS NULL THROW 50001, 'Required roles do not exist.', 1;
IF NOT EXISTS (SELECT 1 FROM Organizations WHERE Id = @organizationId) THROW 50002, 'Organization does not exist.', 1;
IF NOT EXISTS (SELECT 1 FROM Locations WHERE Id = @locationId AND OrganizationId = @organizationId) THROW 50003, 'Location does not belong to organization.', 1;

BEGIN TRANSACTION;
SELECT @adminUserId = Id FROM Users WHERE ExternalSubject = @adminObjectId;
IF @adminUserId IS NULL BEGIN SET @adminUserId = NEWID(); INSERT Users (Id, ExternalSubject, DisplayName) VALUES (@adminUserId, @adminObjectId, 'Counterpoint Admin'); END ELSE UPDATE Users SET Active = 1 WHERE Id = @adminUserId;
SELECT @cashierUserId = Id FROM Users WHERE ExternalSubject = @cashierObjectId;
IF @cashierUserId IS NULL BEGIN SET @cashierUserId = NEWID(); INSERT Users (Id, ExternalSubject, DisplayName) VALUES (@cashierUserId, @cashierObjectId, 'Counterpoint Cashier'); END ELSE UPDATE Users SET Active = 1 WHERE Id = @cashierUserId;

INSERT UserLocations (UserId, OrganizationId, LocationId)
SELECT userId, @organizationId, @locationId FROM (VALUES (@adminUserId), (@cashierUserId)) AS users(userId)
WHERE NOT EXISTS (SELECT 1 FROM UserLocations x WHERE x.UserId = users.userId AND x.OrganizationId = @organizationId AND x.LocationId = @locationId);

INSERT UserRoles (Id, OrganizationId, UserId, RoleId, LocationId)
SELECT NEWID(), @organizationId, @adminUserId, @ownerRoleId, @locationId
WHERE NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = @adminUserId AND OrganizationId = @organizationId AND RoleId = @ownerRoleId AND LocationId = @locationId);
INSERT UserRoles (Id, OrganizationId, UserId, RoleId, LocationId)
SELECT NEWID(), @organizationId, @cashierUserId, @cashierRoleId, @locationId
WHERE NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = @cashierUserId AND OrganizationId = @organizationId AND RoleId = @cashierRoleId AND LocationId = @locationId);
COMMIT TRANSACTION;
```

Verify the results:

```sql
SELECT u.DisplayName, u.ExternalSubject, u.Active, o.Name AS OrganizationName, l.Name AS LocationName, r.Name AS RoleName
FROM Users u JOIN UserLocations ul ON ul.UserId = u.Id JOIN Organizations o ON o.Id = ul.OrganizationId JOIN Locations l ON l.Id = ul.LocationId
JOIN UserRoles ur ON ur.UserId = u.Id AND ur.OrganizationId = ul.OrganizationId AND ur.LocationId = ul.LocationId JOIN Roles r ON r.Id = ur.RoleId
WHERE u.ExternalSubject IN ('<ADMIN_ENTRA_OBJECT_ID>', '<CASHIER_ENTRA_OBJECT_ID>');
```

The admin needs `catalog.read` and `catalog.write`; the cashier needs `catalog.read` and `inventory.purchase.receive`. SQL role changes do not require Bicep, backend, or frontend redeployment.

Migration `007_inventory-batches.sql` includes a `GO` batch separator before it creates the computed `Available` column. Keep that separator when running the file in `sqlcmd` or Query Editor; `Available` depends on the `Reserved` column created in the preceding batch.

Verify the schema:

```sh
/opt/homebrew/bin/sqlcmd \
	-S "${SQL_SERVER_NAME}.database.windows.net" \
	-d counterpoint \
	-U counterpoint \
	-P "$COUNTERPOINT_SQL_ADMIN_PASSWORD" \
	-C \
	-Q "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME;"
```

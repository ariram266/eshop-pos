DECLARE @org uniqueidentifier = '00000000-0000-0000-0000-000000000001';
DECLARE @user uniqueidentifier = '00000000-0000-0000-0000-000000000002';
DECLARE @location uniqueidentifier = '00000000-0000-0000-0000-000000000003';
DECLARE @category uniqueidentifier = '00000000-0000-0000-0000-000000000010';
DECLARE @tax uniqueidentifier = '00000000-0000-0000-0000-000000000011';
DECLARE @station uniqueidentifier = '00000000-0000-0000-0000-000000000012';
DECLARE @product uniqueidentifier = '00000000-0000-0000-0000-000000000013';
DECLARE @register uniqueidentifier = '00000000-0000-0000-0000-000000000014';

IF NOT EXISTS (SELECT 1 FROM Organizations WHERE Id=@org) INSERT Organizations (Id,Name,Currency,TimeZone) VALUES (@org,'Counterpoint Local','USD','UTC');
IF NOT EXISTS (SELECT 1 FROM Users WHERE Id=@user) INSERT Users (Id,ExternalSubject,DisplayName) VALUES (@user,'local-development-user','Local Development User');
IF NOT EXISTS (SELECT 1 FROM Locations WHERE Id=@location) INSERT Locations (Id,OrganizationId,Name,LocationType) VALUES (@location,@org,'Local Cafe','CAFE');
IF NOT EXISTS (SELECT 1 FROM Registers WHERE Id=@register) INSERT Registers (Id,OrganizationId,LocationId,RegisterCode,Name) VALUES (@register,@org,@location,'register-01','Local Register');
IF NOT EXISTS (SELECT 1 FROM Categories WHERE Id=@category) INSERT Categories (Id,OrganizationId,Name) VALUES (@category,@org,'Cafe Menu');
IF NOT EXISTS (SELECT 1 FROM TaxRules WHERE Id=@tax) INSERT TaxRules (Id,OrganizationId,Name,Rate) VALUES (@tax,@org,'Local tax',8.25);
IF NOT EXISTS (SELECT 1 FROM PreparationStations WHERE Id=@station) INSERT PreparationStations (Id,OrganizationId,Name,Code) VALUES (@station,@org,'Counter','COUNTER');
IF NOT EXISTS (SELECT 1 FROM Products WHERE Id=@product) INSERT Products (Id,OrganizationId,CategoryId,TaxRuleId,PreparationStationId,Sku,Name,Unit,ProductType) VALUES (@product,@org,@category,@tax,@station,'COFFEE-01','Coffee','each','MENU_ITEM');
IF NOT EXISTS (SELECT 1 FROM ProductPrices WHERE ProductId=@product AND LocationId=@location AND Active=1) INSERT ProductPrices (Id,OrganizationId,ProductId,LocationId,Price) VALUES (NEWID(),@org,@product,@location,3.50);
IF NOT EXISTS (SELECT 1 FROM InventoryBalances WHERE ProductId=@product AND LocationId=@location) INSERT InventoryBalances (OrganizationId,LocationId,ProductId,OnHand,ReorderLevel) VALUES (@org,@location,@product,100,5);

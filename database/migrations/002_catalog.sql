SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

CREATE TABLE Categories (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    Name nvarchar(200) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_Categories_Active DEFAULT 1,
    CONSTRAINT FK_Categories_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT UQ_Categories_Organization_Name UNIQUE (OrganizationId, Name)
);

CREATE TABLE TaxRules (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_TaxRules PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    Name nvarchar(100) NOT NULL,
    Rate decimal(9,4) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_TaxRules_Active DEFAULT 1,
    CONSTRAINT FK_TaxRules_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id)
);

CREATE TABLE PreparationStations (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_PreparationStations PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    Name nvarchar(100) NOT NULL,
    Code nvarchar(40) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_PreparationStations_Active DEFAULT 1,
    CONSTRAINT FK_PreparationStations_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT UQ_PreparationStations_Organization_Code UNIQUE (OrganizationId, Code)
);

CREATE TABLE Products (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    CategoryId uniqueidentifier NOT NULL,
    TaxRuleId uniqueidentifier NULL,
    PreparationStationId uniqueidentifier NULL,
    Sku nvarchar(80) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Unit nvarchar(40) NOT NULL,
    ProductType nvarchar(40) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_Products_Active DEFAULT 1,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Products_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Products_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES Categories(Id),
    CONSTRAINT FK_Products_TaxRules FOREIGN KEY (TaxRuleId) REFERENCES TaxRules(Id),
    CONSTRAINT FK_Products_Stations FOREIGN KEY (PreparationStationId) REFERENCES PreparationStations(Id),
    CONSTRAINT UQ_Products_Organization_Sku UNIQUE (OrganizationId, Sku)
);

CREATE TABLE ModifierGroups (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_ModifierGroups PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    Name nvarchar(150) NOT NULL,
    Required bit NOT NULL CONSTRAINT DF_ModifierGroups_Required DEFAULT 0,
    Active bit NOT NULL CONSTRAINT DF_ModifierGroups_Active DEFAULT 1,
    CONSTRAINT FK_ModifierGroups_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id)
);

CREATE TABLE Modifiers (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Modifiers PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    ModifierGroupId uniqueidentifier NOT NULL,
    Name nvarchar(150) NOT NULL,
    PriceDelta decimal(19,4) NOT NULL CONSTRAINT DF_Modifiers_PriceDelta DEFAULT 0,
    Active bit NOT NULL CONSTRAINT DF_Modifiers_Active DEFAULT 1,
    CONSTRAINT FK_Modifiers_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Modifiers_Groups FOREIGN KEY (ModifierGroupId) REFERENCES ModifierGroups(Id)
);

CREATE TABLE ProductModifierGroups (
    ProductId uniqueidentifier NOT NULL,
    ModifierGroupId uniqueidentifier NOT NULL,
    CONSTRAINT PK_ProductModifierGroups PRIMARY KEY (ProductId, ModifierGroupId),
    CONSTRAINT FK_ProductModifierGroups_Products FOREIGN KEY (ProductId) REFERENCES Products(Id),
    CONSTRAINT FK_ProductModifierGroups_Groups FOREIGN KEY (ModifierGroupId) REFERENCES ModifierGroups(Id)
);

CREATE TABLE ProductPrices (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_ProductPrices PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    Price decimal(19,4) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_ProductPrices_Active DEFAULT 1,
    EffectiveFrom datetimeoffset(7) NOT NULL CONSTRAINT DF_ProductPrices_EffectiveFrom DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ProductPrices_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_ProductPrices_Products FOREIGN KEY (ProductId) REFERENCES Products(Id),
    CONSTRAINT FK_ProductPrices_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id)
);

CREATE UNIQUE INDEX UX_ProductPrices_Active ON ProductPrices (OrganizationId, ProductId, LocationId) WHERE Active = 1;

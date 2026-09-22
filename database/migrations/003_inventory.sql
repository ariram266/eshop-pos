CREATE TABLE InventoryBalances (
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    OnHand decimal(19,4) NOT NULL CONSTRAINT DF_InventoryBalances_OnHand DEFAULT 0,
    ReorderLevel decimal(19,4) NOT NULL CONSTRAINT DF_InventoryBalances_ReorderLevel DEFAULT 0,
    UpdatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_InventoryBalances_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_InventoryBalances PRIMARY KEY (OrganizationId, LocationId, ProductId),
    CONSTRAINT FK_InventoryBalances_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_InventoryBalances_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT FK_InventoryBalances_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)
);

CREATE TABLE StockMovements (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_StockMovements PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    Quantity decimal(19,4) NOT NULL,
    MovementType nvarchar(40) NOT NULL,
    Source nvarchar(200) NULL,
    Reason nvarchar(500) NULL,
    CreatedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_StockMovements_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_StockMovements_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_StockMovements_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT FK_StockMovements_Products FOREIGN KEY (ProductId) REFERENCES Products(Id),
    CONSTRAINT FK_StockMovements_Users FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

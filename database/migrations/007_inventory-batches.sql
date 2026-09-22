CREATE TABLE Batches (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Batches PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    LotNumber nvarchar(100) NOT NULL,
    Origin nvarchar(300) NULL,
    ProducedAt datetimeoffset(7) NULL,
    ReceivedAt datetimeoffset(7) NULL,
    ExpiresAt datetimeoffset(7) NULL,
    FreshnessStatus nvarchar(40) NULL,
    Status nvarchar(30) NOT NULL CONSTRAINT DF_Batches_Status DEFAULT 'ACTIVE',
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Batches_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Batches_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Batches_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Batches_Products FOREIGN KEY (ProductId) REFERENCES Products(Id),
    CONSTRAINT FK_Batches_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id)
);

ALTER TABLE InventoryBalances ADD BatchId uniqueidentifier NULL;
ALTER TABLE InventoryBalances ADD Reserved decimal(19,4) NOT NULL CONSTRAINT DF_InventoryBalances_Reserved DEFAULT 0;
ALTER TABLE InventoryBalances ADD Available AS (OnHand - Reserved) PERSISTED;
ALTER TABLE InventoryBalances ADD CONSTRAINT FK_InventoryBalances_Batches FOREIGN KEY (BatchId) REFERENCES Batches(Id);
CREATE INDEX IX_InventoryBalances_Batch ON InventoryBalances (OrganizationId, LocationId, ProductId, BatchId);

CREATE TABLE Suppliers (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Suppliers PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    Code nvarchar(80) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Email nvarchar(320) NULL,
    Phone nvarchar(40) NULL,
    Active bit NOT NULL CONSTRAINT DF_Suppliers_Active DEFAULT 1,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Suppliers_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Suppliers_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT UQ_Suppliers_Organization_Code UNIQUE (OrganizationId, Code)
);

CREATE TABLE Purchases (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Purchases PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    SupplierId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    Reference nvarchar(100) NOT NULL,
    Status nvarchar(30) NOT NULL CONSTRAINT DF_Purchases_Status DEFAULT 'RECEIVED',
    CreatedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Purchases_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Purchases_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Purchases_Suppliers FOREIGN KEY (SupplierId) REFERENCES Suppliers(Id),
    CONSTRAINT FK_Purchases_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT FK_Purchases_Users FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE TABLE PurchaseLines (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_PurchaseLines PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    PurchaseId uniqueidentifier NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    Quantity decimal(19,4) NOT NULL,
    UnitCost decimal(19,4) NOT NULL,
    BatchNumber nvarchar(100) NULL,
    ExpiryDate datetimeoffset(7) NULL,
    CONSTRAINT FK_PurchaseLines_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_PurchaseLines_Purchases FOREIGN KEY (PurchaseId) REFERENCES Purchases(Id),
    CONSTRAINT FK_PurchaseLines_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)
);

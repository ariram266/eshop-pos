CREATE TABLE Orders (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    RegisterId nvarchar(80) NOT NULL,
    OrderNumber nvarchar(40) NOT NULL,
    Channel nvarchar(20) NOT NULL,
    OrderType nvarchar(20) NOT NULL,
    Status nvarchar(30) NOT NULL,
    Subtotal decimal(19,4) NOT NULL,
    Tax decimal(19,4) NOT NULL,
    Total decimal(19,4) NOT NULL,
    CreatedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Orders_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Orders_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT FK_Orders_Users FOREIGN KEY (CreatedBy) REFERENCES Users(Id),
    CONSTRAINT UQ_Orders_Organization_Number UNIQUE (OrganizationId, OrderNumber)
);

CREATE TABLE OrderItems (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    OrderId uniqueidentifier NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    Quantity decimal(19,4) NOT NULL,
    UnitPrice decimal(19,4) NOT NULL,
    TaxAmount decimal(19,4) NOT NULL,
    CONSTRAINT FK_OrderItems_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id),
    CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)
);

CREATE TABLE IdempotencyKeys (
    OrganizationId uniqueidentifier NOT NULL,
    IdempotencyKey nvarchar(200) NOT NULL,
    ResponseJson nvarchar(max) NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_IdempotencyKeys_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_IdempotencyKeys PRIMARY KEY (OrganizationId, IdempotencyKey)
);

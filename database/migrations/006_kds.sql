CREATE TABLE KdsWorkItems (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_KdsWorkItems PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    OrderId uniqueidentifier NOT NULL,
    OrderNumber nvarchar(40) NOT NULL,
    ProductId uniqueidentifier NOT NULL,
    ProductName nvarchar(200) NOT NULL,
    Quantity decimal(19,4) NOT NULL,
    StationCode nvarchar(40) NOT NULL,
    Status nvarchar(30) NOT NULL,
    CreatedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_KdsWorkItems_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_KdsWorkItems_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_KdsWorkItems_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_KdsWorkItems_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT FK_KdsWorkItems_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id),
    CONSTRAINT FK_KdsWorkItems_Products FOREIGN KEY (ProductId) REFERENCES Products(Id),
    CONSTRAINT FK_KdsWorkItems_Users FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE TABLE KdsWorkItemHistory (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_KdsWorkItemHistory PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    WorkItemId uniqueidentifier NOT NULL,
    Status nvarchar(30) NOT NULL,
    ChangedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_KdsWorkItemHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_KdsWorkItemHistory_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_KdsWorkItemHistory_WorkItems FOREIGN KEY (WorkItemId) REFERENCES KdsWorkItems(Id),
    CONSTRAINT FK_KdsWorkItemHistory_Users FOREIGN KEY (ChangedBy) REFERENCES Users(Id)
);

CREATE TABLE Permissions (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Permissions PRIMARY KEY,
    Code nvarchar(120) NOT NULL CONSTRAINT UQ_Permissions_Code UNIQUE,
    Description nvarchar(300) NOT NULL
);

CREATE TABLE RolePermissions (
    RoleId uniqueidentifier NOT NULL,
    PermissionId uniqueidentifier NOT NULL,
    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id),
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES Permissions(Id)
);

CREATE TABLE UserLocations (
    UserId uniqueidentifier NOT NULL,
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    CONSTRAINT PK_UserLocations PRIMARY KEY (UserId, OrganizationId, LocationId),
    CONSTRAINT FK_UserLocations_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_UserLocations_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_UserLocations_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id)
);

CREATE TABLE Devices (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Devices PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    RegisterId uniqueidentifier NULL,
    DeviceType nvarchar(20) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Status nvarchar(30) NOT NULL CONSTRAINT DF_Devices_Status DEFAULT 'ACTIVE',
    LastSeenAt datetimeoffset(7) NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Devices_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Devices_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Devices_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT FK_Devices_Registers FOREIGN KEY (RegisterId) REFERENCES Registers(Id)
);

CREATE TABLE AuditEvents (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_AuditEvents PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    ActorId uniqueidentifier NOT NULL,
    Action nvarchar(120) NOT NULL,
    EntityType nvarchar(120) NOT NULL,
    EntityId uniqueidentifier NULL,
    BeforeJson nvarchar(max) NULL,
    AfterJson nvarchar(max) NULL,
    CorrelationId nvarchar(100) NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_AuditEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AuditEvents_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_AuditEvents_Users FOREIGN KEY (ActorId) REFERENCES Users(Id)
);

MERGE Permissions AS target
USING (VALUES
    ('catalog.read', 'Read catalog'), ('catalog.write', 'Manage catalog'),
    ('inventory.read', 'Read inventory'), ('inventory.adjust', 'Adjust inventory'), ('inventory.transfer', 'Transfer inventory'),
    ('orders.create', 'Create orders'), ('orders.read', 'Read orders'), ('orders.cancel', 'Cancel orders'), ('orders.refund', 'Refund orders'),
    ('payments.read', 'Read payments'), ('payments.refund', 'Refund payments'), ('users.manage', 'Manage users'),
    ('locations.manage', 'Manage locations'), ('devices.manage', 'Manage devices'), ('kds.execute', 'Execute KDS work')
) AS source(Code, Description) ON target.Code = source.Code
WHEN NOT MATCHED THEN INSERT (Id, Code, Description) VALUES (NEWID(), source.Code, source.Description);

INSERT RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r JOIN Permissions p ON p.Code IN ('catalog.read', 'inventory.read', 'orders.create', 'orders.read', 'payments.read')
WHERE r.Name IN ('Cashier', 'StoreManager', 'OperationsManager', 'OrganizationOwner', 'PlatformAdmin')
AND NOT EXISTS (SELECT 1 FROM RolePermissions existing WHERE existing.RoleId=r.Id AND existing.PermissionId=p.Id);

INSERT RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r JOIN Permissions p ON p.Code IN ('kds.execute', 'orders.read')
WHERE r.Name IN ('KitchenStaff', 'CounterStaff', 'JuiceStaff', 'StoreManager', 'OperationsManager', 'OrganizationOwner', 'PlatformAdmin')
AND NOT EXISTS (SELECT 1 FROM RolePermissions existing WHERE existing.RoleId=r.Id AND existing.PermissionId=p.Id);

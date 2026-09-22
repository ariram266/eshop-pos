CREATE TABLE Organizations (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Organizations PRIMARY KEY,
    Name nvarchar(200) NOT NULL,
    Currency char(3) NOT NULL,
    TimeZone nvarchar(100) NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Organizations_CreatedAt DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Roles (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    Name nvarchar(80) NOT NULL CONSTRAINT UQ_Roles_Name UNIQUE
);

CREATE TABLE Users (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    ExternalSubject nvarchar(200) NOT NULL CONSTRAINT UQ_Users_ExternalSubject UNIQUE,
    DisplayName nvarchar(200) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_Users_Active DEFAULT 1,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Locations (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Locations PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    Name nvarchar(200) NOT NULL,
    LocationType nvarchar(40) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_Locations_Active DEFAULT 1,
    CONSTRAINT FK_Locations_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT UQ_Locations_Organization_Name UNIQUE (OrganizationId, Name)
);

CREATE TABLE UserRoles (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_UserRoles PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    UserId uniqueidentifier NOT NULL,
    RoleId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NULL,
    CONSTRAINT FK_UserRoles_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id),
    CONSTRAINT FK_UserRoles_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id)
);

CREATE UNIQUE INDEX UX_UserRoles_Scope ON UserRoles (OrganizationId, UserId, RoleId, LocationId);

CREATE TABLE Registers (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Registers PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    LocationId uniqueidentifier NOT NULL,
    RegisterCode nvarchar(80) NOT NULL,
    Name nvarchar(200) NOT NULL,
    Active bit NOT NULL CONSTRAINT DF_Registers_Active DEFAULT 1,
    CONSTRAINT FK_Registers_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Registers_Locations FOREIGN KEY (LocationId) REFERENCES Locations(Id),
    CONSTRAINT UQ_Registers_Location_Code UNIQUE (OrganizationId, LocationId, RegisterCode)
);

INSERT INTO Roles (Id, Name) VALUES
(NEWID(), 'PlatformAdmin'), (NEWID(), 'OrganizationOwner'), (NEWID(), 'OperationsManager'),
(NEWID(), 'StoreManager'), (NEWID(), 'Cashier'), (NEWID(), 'KitchenStaff'),
(NEWID(), 'CounterStaff'), (NEWID(), 'JuiceStaff'), (NEWID(), 'Accountant'), (NEWID(), 'Customer');

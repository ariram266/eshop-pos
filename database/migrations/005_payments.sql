CREATE TABLE Payments (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    OrderId uniqueidentifier NOT NULL,
    Amount decimal(19,4) NOT NULL,
    Currency char(3) NOT NULL,
    Method nvarchar(20) NOT NULL,
    Provider nvarchar(80) NOT NULL,
    ProviderReference nvarchar(200) NULL,
    Status nvarchar(40) NOT NULL,
    CreatedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Payments_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id),
    CONSTRAINT FK_Payments_Users FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE TABLE PaymentStateHistory (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_PaymentStateHistory PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    PaymentId uniqueidentifier NOT NULL,
    Status nvarchar(40) NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_PaymentStateHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PaymentStateHistory_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_PaymentStateHistory_Payments FOREIGN KEY (PaymentId) REFERENCES Payments(Id)
);

CREATE TABLE Refunds (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_Refunds PRIMARY KEY,
    OrganizationId uniqueidentifier NOT NULL,
    PaymentId uniqueidentifier NOT NULL,
    OrderId uniqueidentifier NOT NULL,
    Amount decimal(19,4) NOT NULL,
    Reason nvarchar(500) NOT NULL,
    Status nvarchar(30) NOT NULL,
    CreatedBy uniqueidentifier NOT NULL,
    CreatedAt datetimeoffset(7) NOT NULL CONSTRAINT DF_Refunds_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Refunds_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT FK_Refunds_Payments FOREIGN KEY (PaymentId) REFERENCES Payments(Id),
    CONSTRAINT FK_Refunds_Orders FOREIGN KEY (OrderId) REFERENCES Orders(Id),
    CONSTRAINT FK_Refunds_Users FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE TABLE OrderNumberSequences (
    OrganizationId uniqueidentifier NOT NULL,
    BusinessDate date NOT NULL,
    LastNumber int NOT NULL CONSTRAINT DF_OrderNumberSequences_LastNumber DEFAULT 0,
    CONSTRAINT PK_OrderNumberSequences PRIMARY KEY (OrganizationId, BusinessDate),
    CONSTRAINT FK_OrderNumberSequences_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id),
    CONSTRAINT CK_OrderNumberSequences_LastNumber CHECK (LastNumber >= 0)
);
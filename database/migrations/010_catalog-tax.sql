IF COL_LENGTH('Products', 'HsnCode') IS NULL EXEC(N'ALTER TABLE Products ADD HsnCode nvarchar(40) NULL');
IF COL_LENGTH('Products', 'GstRate') IS NULL EXEC(N'ALTER TABLE Products ADD GstRate decimal(9,4) NOT NULL CONSTRAINT DF_Products_GstRate DEFAULT 0');
IF COL_LENGTH('Products', 'CgstRate') IS NULL EXEC(N'ALTER TABLE Products ADD CgstRate AS (GstRate / 2) PERSISTED');
IF COL_LENGTH('Products', 'SgstRate') IS NULL EXEC(N'ALTER TABLE Products ADD SgstRate AS (GstRate / 2) PERSISTED');

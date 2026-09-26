IF COL_LENGTH('Locations', 'GstNumber') IS NULL
    ALTER TABLE Locations ADD GstNumber nvarchar(30) NULL;

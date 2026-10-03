IF COL_LENGTH('PurchaseLines', 'AffectsInventory') IS NULL
    ALTER TABLE PurchaseLines ADD AffectsInventory bit NOT NULL CONSTRAINT DF_PurchaseLines_AffectsInventory DEFAULT 1 WITH VALUES;
IF COL_LENGTH('Locations', 'KdsEnabled') IS NULL
    ALTER TABLE Locations ADD KdsEnabled bit NOT NULL CONSTRAINT DF_Locations_KdsEnabled DEFAULT 1 WITH VALUES;

INSERT RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM Roles r
JOIN Permissions p ON p.Code = 'locations.manage'
WHERE r.Name IN ('OrganizationOwner', 'OperationsManager', 'StoreManager')
AND NOT EXISTS (
    SELECT 1 FROM RolePermissions existing
    WHERE existing.RoleId = r.Id AND existing.PermissionId = p.Id
);
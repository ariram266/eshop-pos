MERGE Permissions AS target
USING (VALUES ('inventory.purchase.receive', 'Receive purchases')) AS source(Code, Description)
ON target.Code = source.Code
WHEN NOT MATCHED THEN INSERT (Id, Code, Description) VALUES (NEWID(), source.Code, source.Description);

INSERT RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.Name = 'Cashier' AND p.Code = 'inventory.purchase.receive'
AND NOT EXISTS (SELECT 1 FROM RolePermissions existing WHERE existing.RoleId=r.Id AND existing.PermissionId=p.Id);

INSERT RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id FROM Roles r CROSS JOIN Permissions p
WHERE r.Name IN ('OrganizationOwner', 'OperationsManager', 'StoreManager')
  AND p.Code = 'inventory.purchase.receive'
  AND NOT EXISTS (SELECT 1 FROM RolePermissions existing WHERE existing.RoleId = r.Id AND existing.PermissionId = p.Id);

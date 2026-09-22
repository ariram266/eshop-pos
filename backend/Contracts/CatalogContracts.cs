namespace Counterpoint.Contracts;

public sealed record CategoryDto(Guid Id, string Name, Guid? ParentId = null, bool Active = true);
public sealed record CreateCategoryRequest(string Name, Guid? ParentId = null);
public sealed record UpdateCategoryRequest(string Name, Guid? ParentId, bool Active);
public sealed record CreateProductRequest(string Sku, string Name, Guid CategoryId, decimal Price, string Unit, string ProductType, Guid? TaxRuleId, Guid? PreparationStationId, string? HsnCode, decimal GstRate, bool TrackInventory = true);
public sealed record UpdateProductRequest(string Sku, string Name, Guid CategoryId, decimal Price, string Unit, string ProductType, string? HsnCode, decimal GstRate, bool Active, bool TrackInventory = true);
public sealed record CatalogProductDto(Guid Id, string Sku, string Name, Guid CategoryId, decimal Price, string Unit, string ProductType, bool Active, bool TrackInventory);

namespace Counterpoint.Contracts;

public sealed record CreateCategoryRequest(string Name);
public sealed record CreateProductRequest(string Sku, string Name, Guid CategoryId, decimal Price, string Unit, string ProductType, Guid? TaxRuleId, Guid? PreparationStationId, string? HsnCode, decimal GstRate);
public sealed record UpdateProductRequest(string Sku, string Name, Guid CategoryId, decimal Price, string Unit, string ProductType, string? HsnCode, decimal GstRate, bool Active);
public sealed record CatalogProductDto(Guid Id, string Sku, string Name, Guid CategoryId, decimal Price, string Unit, string ProductType, bool Active);

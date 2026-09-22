namespace Counterpoint.Contracts;

public sealed record SupplierDto(Guid Id, string Code, string Name, string? Email, string? Phone, bool Active);
public sealed record CreateSupplierRequest(string Code, string Name, string? Email, string? Phone);
public sealed record UpdateSupplierRequest(string Code, string Name, string? Email, string? Phone, bool Active);
public sealed record PurchaseLineRequest(Guid ProductId, decimal Quantity, decimal UnitCost, string? BatchNumber, DateTimeOffset? ExpiryDate);
public sealed record CreatePurchaseRequest(Guid SupplierId, Guid LocationId, string Reference, IReadOnlyList<PurchaseLineRequest> Lines);
public sealed record PurchaseLineDto(Guid ProductId, string ProductName, decimal Quantity, decimal UnitCost, string? BatchNumber, DateTimeOffset? ExpiryDate);
public sealed record PurchaseDto(Guid Id, string Reference, Guid SupplierId, string SupplierName, Guid LocationId, decimal Total, string Status, DateTimeOffset CreatedAt, IReadOnlyList<PurchaseLineDto> Lines);
public sealed record InventorySummaryDto(Guid ProductId, string Sku, string ProductName, decimal OnHand, decimal Reserved, decimal Available, decimal ReorderLevel, bool LowStock);
public sealed record StockMovementDto(Guid Id, Guid ProductId, string ProductName, decimal Quantity, string MovementType, string? Source, DateTimeOffset CreatedAt);
public sealed record SalesSummaryDto(int OrderCount, decimal GrossSales, decimal Tax, decimal NetSales, DateTimeOffset From, DateTimeOffset To);
public sealed record SalesHistoryLineDto(Guid ProductId, string ProductName, string CategoryName, string? HsnCode, decimal GstRate, decimal CgstRate, decimal SgstRate, decimal Quantity, decimal UnitPrice, decimal TaxAmount);
public sealed record SalesHistoryDto(Guid OrderId, string OrderNumber, decimal Total, string Status, string PaymentStatus, DateTimeOffset CreatedAt, IReadOnlyList<SalesHistoryLineDto> Lines);

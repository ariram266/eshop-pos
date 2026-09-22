namespace Counterpoint.Contracts;

public sealed record ActorContext(Guid OrganizationId, Guid UserId, Guid LocationId, string Role, string DisplayName);
public sealed record PosBootstrap(IReadOnlyList<CategoryDto> Categories, IReadOnlyList<ProductDto> Products, IReadOnlyList<ModifierGroupDto> ModifierGroups, IReadOnlyList<ModifierDto> Modifiers, IReadOnlyList<TaxRuleDto> TaxRules, IReadOnlyList<PreparationStationDto> PreparationStations, Guid LocationId, string Currency);
public sealed record ProductDto(Guid Id, string Sku, string Name, Guid CategoryId, decimal Price, string Unit, decimal AvailableQuantity, string ProductType, Guid? PreparationStationId, decimal TaxRate, bool Active, string? HsnCode = null, decimal GstRate = 0, decimal CgstRate = 0, decimal SgstRate = 0, bool TrackInventory = true);
public sealed record TaxRuleDto(Guid Id, string Name, decimal Rate);
public sealed record PreparationStationDto(Guid Id, string Name, string Code);
public sealed record ModifierGroupDto(Guid Id, string Name, bool Required);
public sealed record ModifierDto(Guid Id, Guid ModifierGroupId, string Name, decimal PriceDelta);
public sealed record CreateOrderRequest(string RegisterId, string OrderType, string PaymentMethod, IReadOnlyList<CreateOrderLine> Lines);
public sealed record CreateOrderLine(Guid ProductId, decimal Quantity);
public sealed record OrderDto(Guid Id, string OrderNumber, string Status, decimal Subtotal, decimal Tax, decimal Total, string PaymentStatus, IReadOnlyList<OrderLineDto> Lines, DateTimeOffset CreatedAt);
public sealed record OrderLineDto(Guid ProductId, string Name, decimal Quantity, decimal UnitPrice, decimal TaxAmount, string? PreparationStationCode);
public sealed record KdsWorkItemDto(Guid Id, Guid OrderId, string OrderNumber, string ProductName, decimal Quantity, string StationCode, string Status, DateTimeOffset CreatedAt);
public sealed record UpdateKdsStatusRequest(string Status);
public sealed record UpdateOrderStatusRequest(string Status);
public sealed record RefundOrderRequest(decimal Amount, string Reason);

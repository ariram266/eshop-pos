using System.Net;
using System.Text.Json;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class OperationsFunctions(TenantContext tenantContext, AuthorizationService authorization, OperationsService operations)
{
    [Function("ListSuppliers")]
    public Task<HttpResponseData> Suppliers([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "suppliers")] HttpRequestData request, CancellationToken cancellationToken) => Execute(request, cancellationToken, "catalog.read", actor => operations.GetSuppliersAsync(actor, cancellationToken));

    [Function("CreateSupplier")]
    public async Task<HttpResponseData> CreateSupplier([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "suppliers")] HttpRequestData request, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "catalog.write", async actor => await operations.CreateSupplierAsync(actor, await Body<CreateSupplierRequest>(request, cancellationToken), cancellationToken));

    [Function("UpdateSupplier")]
    public async Task<HttpResponseData> UpdateSupplier([HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "suppliers/{id:guid}")] HttpRequestData request, Guid id, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "catalog.write", async actor => await operations.UpdateSupplierAsync(actor, id, await Body<UpdateSupplierRequest>(request, cancellationToken), cancellationToken));

    [Function("ListPurchases")]
    public Task<HttpResponseData> Purchases([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "purchases")] HttpRequestData request, CancellationToken cancellationToken) => Execute(request, cancellationToken, "inventory.read", actor => operations.GetPurchasesAsync(actor, cancellationToken));

    [Function("ReceivePurchase")]
    public async Task<HttpResponseData> ReceivePurchase([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "purchases/receive")] HttpRequestData request, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "inventory.purchase.receive", async actor => await operations.ReceivePurchaseAsync(actor, await Body<CreatePurchaseRequest>(request, cancellationToken), cancellationToken));

    [Function("UpdatePurchase")]
    public async Task<HttpResponseData> UpdatePurchase([HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "purchases/{id:guid}")] HttpRequestData request, Guid id, CancellationToken cancellationToken) => await Execute(request, cancellationToken, "inventory.adjust", async actor => await operations.UpdatePurchaseAsync(actor, id, await Body<CreatePurchaseRequest>(request, cancellationToken), cancellationToken));

    [Function("InventorySummary")]
    public Task<HttpResponseData> Inventory([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "inventory")] HttpRequestData request, CancellationToken cancellationToken) => Execute(request, cancellationToken, "inventory.read", actor => operations.GetInventoryAsync(actor, cancellationToken));

    [Function("StockMovements")]
    public Task<HttpResponseData> Movements([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "stock-movements")] HttpRequestData request, CancellationToken cancellationToken) => Execute(request, cancellationToken, "inventory.read", actor => operations.GetMovementsAsync(actor, cancellationToken));

    [Function("SalesHistory")]
    public Task<HttpResponseData> Sales([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "sales")] HttpRequestData request, CancellationToken cancellationToken) => Execute(request, cancellationToken, "orders.read", actor => operations.GetSalesAsync(actor, cancellationToken));

    [Function("SalesSummary")]
    public async Task<HttpResponseData> Summary([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "reports/sales")] HttpRequestData request, CancellationToken cancellationToken)
    {
        var from = DateTimeOffset.TryParse(request.Query["from"], out var parsedFrom) ? parsedFrom : DateTimeOffset.UtcNow.Date;
        var to = DateTimeOffset.TryParse(request.Query["to"], out var parsedTo) ? parsedTo : DateTimeOffset.UtcNow.AddDays(1).Date;
        return await Execute(request, cancellationToken, "orders.read", actor => operations.GetSalesSummaryAsync(actor, from, to, cancellationToken));
    }

    private async Task<HttpResponseData> Execute<T>(HttpRequestData request, CancellationToken cancellationToken, string permission, Func<ActorContext, Task<T>> action)
    {
        try { var actor = await tenantContext.ResolveAsync(request, cancellationToken); await authorization.RequirePermissionAsync(actor, permission, cancellationToken); var response = request.CreateResponse(HttpStatusCode.OK); await response.WriteAsJsonAsync(await action(actor), cancellationToken); return response; }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException or ArgumentException or InvalidOperationException or KeyNotFoundException) { var code = exception is UnauthorizedAccessException ? HttpStatusCode.Unauthorized : exception is ForbiddenException ? HttpStatusCode.Forbidden : HttpStatusCode.BadRequest; var response = request.CreateResponse(code); await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken); return response; }
    }

    private static async Task<T> Body<T>(HttpRequestData request, CancellationToken cancellationToken) => await JsonSerializer.DeserializeAsync<T>(request.Body, new JsonSerializerOptions(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true }, cancellationToken) ?? throw new ArgumentException("Invalid operations request.");
}

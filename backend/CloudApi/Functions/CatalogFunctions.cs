using System.Net;
using System.Text.Json;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class CatalogFunctions(TenantContext tenantContext, AuthorizationService authorization, CatalogService catalog)
{
    [Function("CreateCategory")]
    public async Task<HttpResponseData> CreateCategory([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "categories")] HttpRequestData request, CancellationToken cancellationToken)
        => await Execute(request, cancellationToken, async actor => await catalog.CreateCategoryAsync(actor, await Body<CreateCategoryRequest>(request, cancellationToken), cancellationToken));

    [Function("UpdateCategory")]
    public async Task<HttpResponseData> UpdateCategory([HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "categories/{id:guid}")] HttpRequestData request, Guid id, CancellationToken cancellationToken)
        => await Execute(request, cancellationToken, async actor => await catalog.UpdateCategoryAsync(actor, id, await Body<UpdateCategoryRequest>(request, cancellationToken), cancellationToken));

    [Function("CreateProduct")]
    public async Task<HttpResponseData> CreateProduct([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "products")] HttpRequestData request, CancellationToken cancellationToken)
        => await Execute(request, cancellationToken, async actor => await catalog.CreateProductAsync(actor, await Body<CreateProductRequest>(request, cancellationToken), cancellationToken));

    [Function("UpdateProduct")]
    public async Task<HttpResponseData> UpdateProduct([HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "products/{id:guid}")] HttpRequestData request, Guid id, CancellationToken cancellationToken)
        => await Execute(request, cancellationToken, async actor => await catalog.UpdateProductAsync(actor, id, await Body<UpdateProductRequest>(request, cancellationToken), cancellationToken));

    private async Task<HttpResponseData> Execute<T>(HttpRequestData request, CancellationToken cancellationToken, Func<ActorContext, Task<T>> action)
    {
        try { var actor = tenantContext.Resolve(request); await authorization.RequirePermissionAsync(actor, "catalog.write", cancellationToken); var response = request.CreateResponse(HttpStatusCode.Created); await response.WriteAsJsonAsync(await action(actor), cancellationToken); return response; }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException or ArgumentException or KeyNotFoundException or SqlException) { var response = request.CreateResponse(exception is UnauthorizedAccessException ? HttpStatusCode.Unauthorized : exception is ForbiddenException ? HttpStatusCode.Forbidden : exception is KeyNotFoundException ? HttpStatusCode.NotFound : HttpStatusCode.BadRequest); await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken); return response; }
    }

    private static async Task<T> Body<T>(HttpRequestData request, CancellationToken cancellationToken) => await JsonSerializer.DeserializeAsync<T>(request.Body, new JsonSerializerOptions(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true }, cancellationToken) ?? throw new ArgumentException("Invalid catalog request.");
}

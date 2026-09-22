using System.Net;
using System.Text.Json;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class OrderFunctions(TenantContext tenantContext, AuthorizationService authorization, OrderService orders)
{
    [Function("CreateOrder")]
    public async Task<HttpResponseData> Create([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "orders")] HttpRequestData request, CancellationToken cancellationToken)
    {
        try
        {
            var actor = tenantContext.Resolve(request);
            await authorization.RequirePermissionAsync(actor, "orders.create", cancellationToken);
            var key = request.Headers.TryGetValues("Idempotency-Key", out var values) ? values.FirstOrDefault() : null;
            if (string.IsNullOrWhiteSpace(key)) throw new ArgumentException("Idempotency-Key is required.");
            var input = await JsonSerializer.DeserializeAsync<CreateOrderRequest>(request.Body, new JsonSerializerOptions(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true }, cancellationToken) ?? throw new ArgumentException("Invalid order body.");
            if (input.Lines is null) throw new ArgumentException("Order lines are required.");
            var result = await orders.CreateAsync(actor, input, key, cancellationToken);
            var response = request.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(result, cancellationToken);
            return response;
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException or ArgumentException or InvalidOperationException)
        {
            var status = exception is UnauthorizedAccessException ? HttpStatusCode.Unauthorized : exception is ForbiddenException ? HttpStatusCode.Forbidden : HttpStatusCode.BadRequest;
            var response = request.CreateResponse(status);
            await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken);
            return response;
        }
    }
}

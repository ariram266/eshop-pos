using System.Net;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Infrastructure;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class PosFunctions(TenantContext tenantContext, AuthorizationService authorization, OrderService orders)
{
    [Function("PosBootstrap")]
    public async Task<HttpResponseData> Bootstrap([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "pos/bootstrap")] HttpRequestData request, CancellationToken cancellationToken)
    {
        try
        {
            var actor = await tenantContext.ResolveAsync(request, cancellationToken);
            await authorization.RequirePermissionAsync(actor, "catalog.read", cancellationToken);
            var response = request.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(await orders.GetBootstrapAsync(actor, cancellationToken), cancellationToken);
            return response;
        }
        catch (Exception exception) when (exception is UnauthorizedAccessException or ForbiddenException)
        {
            var response = request.CreateResponse(exception is ForbiddenException ? HttpStatusCode.Forbidden : HttpStatusCode.Unauthorized);
            await response.WriteAsJsonAsync(new { error = exception.Message }, cancellationToken);
            return response;
        }
    }
}

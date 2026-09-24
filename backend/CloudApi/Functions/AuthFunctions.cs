using System.Net;
using Counterpoint.CloudApi.Infrastructure;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Functions;

public sealed class AuthFunctions(TenantContext tenantContext)
{
    [Function("CurrentUser")]
    public async Task<HttpResponseData> CurrentUser([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "auth/me")] HttpRequestData request)
    {
        try
        {
            var actor = await tenantContext.ResolveAsync(request, CancellationToken.None);
            var response = request.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(actor);
            return response;
        }
        catch (UnauthorizedAccessException exception)
        {
            var response = request.CreateResponse(HttpStatusCode.Unauthorized);
            await response.WriteAsJsonAsync(new { error = exception.Message });
            return response;
        }
    }
}

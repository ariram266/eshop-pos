using Microsoft.Azure.Functions.Worker.Http;

namespace Counterpoint.CloudApi.Infrastructure;

public static class Correlation
{
    public static string GetOrCreate(HttpRequestData request)
    {
        if (request.Headers.TryGetValues("x-correlation-id", out var values) && values.FirstOrDefault() is { Length: > 0 } supplied)
            return supplied;
        return Guid.NewGuid().ToString("N");
    }

    public static HttpResponseData WithHeader(HttpResponseData response, string correlationId)
    {
        response.Headers.Add("x-correlation-id", correlationId);
        return response;
    }
}

using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class WebPubSubNotifier(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<WebPubSubNotifier> logger)
{
    private readonly string? _endpoint = configuration["WEBPUBSUB_NOTIFY_URL"];
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
    private readonly ILogger<WebPubSubNotifier> _logger = logger;

    public async Task PublishOrderAsync(Guid organizationId, Guid locationId, Guid orderId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_endpoint)) return;
        try
        {
            var client = _httpClientFactory.CreateClient();
            await client.PostAsJsonAsync(_endpoint, new { organizationId, locationId, orderId }, cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Web PubSub notification failed after order {OrderId}; SQL remains authoritative.", orderId);
        }
    }

    public Task PublishKdsAsync(Guid organizationId, Guid locationId, Guid workItemId, string status, CancellationToken cancellationToken)
        => PublishAsync(new { type = "kds.status.changed", organizationId, locationId, workItemId, status }, cancellationToken);

    private async Task PublishAsync(object payload, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_endpoint)) return;
        try
        {
            var client = _httpClientFactory.CreateClient();
            await client.PostAsJsonAsync(_endpoint, payload, cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Web PubSub notification failed; SQL remains authoritative.");
        }
    }
}

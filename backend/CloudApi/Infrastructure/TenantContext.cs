using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Counterpoint.Contracts;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class TenantContext(IConfiguration configuration, SqlConnectionFactory connections)
{
    public async Task<ActorContext> ResolveAsync(HttpRequestData request, CancellationToken cancellationToken)
    {
        if (configuration["AZURE_FUNCTIONS_ENVIRONMENT"] == "Development" && configuration.GetValue<bool>("COUNTERPOINT_LOCAL_DEV_AUTH"))
        {
            var localRole = GetLocalDevRole(request);
            return new ActorContext(LocalIds.Organization, LocalIds.User, LocalIds.Location, localRole, $"Local Development {localRole}");
        }

        var principal = new ClaimsPrincipal(request.Identities);
        var claims = principal?.Claims ?? Enumerable.Empty<Claim>();
        var clientPrincipal = ReadClientPrincipal(request);
        var externalSubject = ReadSubject(clientPrincipal?.Claims)
            ?? ReadSubject(claims)
            ?? clientPrincipal?.UserId;
        if (string.IsNullOrWhiteSpace(externalSubject))
            throw new UnauthorizedAccessException("A verified Entra subject is required.");

        await using var connection = connections.Create();
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT TOP (1) u.Id, ul.OrganizationId, ul.LocationId, r.Name, u.DisplayName FROM Users u JOIN UserLocations ul ON ul.UserId=u.Id JOIN UserRoles ur ON ur.UserId=u.Id AND ur.OrganizationId=ul.OrganizationId AND (ur.LocationId IS NULL OR ur.LocationId=ul.LocationId) JOIN Roles r ON r.Id=ur.RoleId WHERE u.ExternalSubject=@subject AND u.Active=1 ORDER BY CASE WHEN ur.LocationId=ul.LocationId THEN 0 ELSE 1 END, r.Name;";
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("subject", externalSubject);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            throw new UnauthorizedAccessException("Your Entra account is not provisioned as an active Counterpoint user.");

        return new ActorContext(reader.GetGuid(1), reader.GetGuid(0), reader.GetGuid(2), reader.GetString(3), reader.GetString(4));
    }

    private static ClientPrincipal? ReadClientPrincipal(HttpRequestData request)
    {
        if (!request.Headers.TryGetValues("X-MS-CLIENT-PRINCIPAL", out var values)) return null;
        var encoded = values.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(encoded)) return null;
        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
            return JsonSerializer.Deserialize<ClientPrincipal>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        catch (FormatException) { return null; }
        catch (JsonException) { return null; }
    }

    private static string? ReadSubject(IEnumerable<ClientClaim>? claims) => claims?.FirstOrDefault(c => IsSubjectClaim(c.Type))?.Value;

    private static string? ReadSubject(IEnumerable<Claim> claims) => claims.FirstOrDefault(c => IsSubjectClaim(c.Type))?.Value;

    private static bool IsSubjectClaim(string? type) =>
        !string.IsNullOrWhiteSpace(type)
        && (string.Equals(type, "oid", StringComparison.OrdinalIgnoreCase)
        || string.Equals(type, "sub", StringComparison.OrdinalIgnoreCase)
        || string.Equals(type, "objectidentifier", StringComparison.OrdinalIgnoreCase)
        || string.Equals(type, ClaimTypes.NameIdentifier, StringComparison.OrdinalIgnoreCase)
        || type.EndsWith("/objectidentifier", StringComparison.OrdinalIgnoreCase));

    private sealed record ClientPrincipal(string? UserId, string? UserDetails, List<ClientClaim> Claims);
    private sealed record ClientClaim(string Type, string Value);

    private static string GetLocalDevRole(HttpRequestData request)
    {
        if (request.Headers.TryGetValues("X-Local-Dev-Role", out var values))
        {
            var requestedRole = values.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(requestedRole))
                return requestedRole.Trim();
        }

        return "OrganizationOwner";
    }

    private static class LocalIds
    {
        public static readonly Guid Organization = Guid.Parse("00000000-0000-0000-0000-000000000001");
        public static readonly Guid User = Guid.Parse("00000000-0000-0000-0000-000000000002");
        public static readonly Guid Location = Guid.Parse("00000000-0000-0000-0000-000000000003");
    }

}

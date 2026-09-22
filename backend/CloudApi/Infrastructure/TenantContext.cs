using System.Security.Claims;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Counterpoint.Contracts;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class TenantContext(IConfiguration configuration)
{
    public ActorContext Resolve(HttpRequestData request)
    {
        if (configuration["AZURE_FUNCTIONS_ENVIRONMENT"] == "Development" && configuration.GetValue<bool>("COUNTERPOINT_LOCAL_DEV_AUTH"))
            return new ActorContext(LocalIds.Organization, LocalIds.User, LocalIds.Location, "OrganizationOwner", "Local Development User");

        var principal = new ClaimsPrincipal(request.Identities);
        var claims = principal?.Claims ?? Enumerable.Empty<Claim>();
        var organization = ReadGuid(claims, "organization_id", "org_id");
        var user = ReadGuid(claims, ClaimTypes.NameIdentifier, "sub");
        var location = ReadGuid(claims, "location_id", "location");
        var role = claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value;
        var name = principal?.Identity?.Name ?? claims.FirstOrDefault(c => c.Type == "name")?.Value;

        if (organization is null || user is null || location is null || string.IsNullOrWhiteSpace(role))
            throw new UnauthorizedAccessException("Verified organization, user, location, and role claims are required.");

        return new ActorContext(organization.Value, user.Value, location.Value, role, name ?? user.Value.ToString());
    }

    private static class LocalIds
    {
        public static readonly Guid Organization = Guid.Parse("00000000-0000-0000-0000-000000000001");
        public static readonly Guid User = Guid.Parse("00000000-0000-0000-0000-000000000002");
        public static readonly Guid Location = Guid.Parse("00000000-0000-0000-0000-000000000003");
    }

    private static Guid? ReadGuid(IEnumerable<Claim> claims, params string[] types)
    {
        var value = claims.FirstOrDefault(c => types.Contains(c.Type, StringComparer.OrdinalIgnoreCase))?.Value;
        return Guid.TryParse(value, out var result) ? result : null;
    }
}

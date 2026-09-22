using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class AuthorizationService(SqlConnectionFactory connections, IConfiguration configuration)
{
    public void Require(ActorContext actor, params string[] roles)
    {
        if (!roles.Contains(actor.Role, StringComparer.OrdinalIgnoreCase))
            throw new ForbiddenException("The authenticated role is not authorized for this operation.");
    }

    public async Task RequirePermissionAsync(ActorContext actor, string permission, CancellationToken cancellationToken)
    {
        if (configuration["AZURE_FUNCTIONS_ENVIRONMENT"] == "Development" && configuration.GetValue<bool>("COUNTERPOINT_LOCAL_DEV_AUTH")) return;
        await using var connection = connections.Create();
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT 1 FROM Users u JOIN UserLocations ul ON ul.UserId=u.Id AND ul.OrganizationId=@org AND ul.LocationId=@location JOIN UserRoles ur ON ur.UserId=u.Id AND ur.OrganizationId=@org AND (ur.LocationId IS NULL OR ur.LocationId=@location) JOIN Roles r ON r.Id=ur.RoleId JOIN RolePermissions rp ON rp.RoleId=r.Id JOIN Permissions p ON p.Id=rp.PermissionId WHERE u.Id=@user AND u.Active=1 AND p.Code=@permission;";
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); command.Parameters.AddWithValue("user", actor.UserId); command.Parameters.AddWithValue("permission", permission);
        if (await command.ExecuteScalarAsync(cancellationToken) is null) throw new ForbiddenException("The authenticated user is not authorized for this organization, location, and action.");
    }
}

public sealed class ForbiddenException(string message) : Exception(message);

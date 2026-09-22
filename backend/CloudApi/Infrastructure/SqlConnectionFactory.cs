using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class SqlConnectionFactory(IConfiguration configuration)
{
    private readonly string _connectionString = configuration.GetConnectionString("AzureSql")
        ?? configuration["AZURE_SQL_CONNECTION_STRING"]
        ?? throw new InvalidOperationException("AZURE_SQL_CONNECTION_STRING is required.");

    public SqlConnection Create() => new(_connectionString);
}

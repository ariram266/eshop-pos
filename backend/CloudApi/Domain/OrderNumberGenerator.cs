using System.Data;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain;

public static class OrderNumberGenerator
{
    public static string Format(DateOnly businessDate, int sequence)
    {
        if (sequence < 1) throw new ArgumentOutOfRangeException(nameof(sequence));
        return $"{businessDate:yyMMdd}-{sequence:D4}";
    }

    public static async Task<string> NextAsync(SqlConnection connection, SqlTransaction transaction, Guid organizationId, DateOnly businessDate, CancellationToken cancellationToken)
    {
        int lastNumber;
        await using (var select = new SqlCommand("SELECT LastNumber FROM OrderNumberSequences WITH (UPDLOCK,HOLDLOCK) WHERE OrganizationId=@org AND BusinessDate=@businessDate;", connection, transaction))
        {
            select.Parameters.AddWithValue("org", organizationId);
            select.Parameters.Add("businessDate", SqlDbType.Date).Value = businessDate.ToDateTime(TimeOnly.MinValue);
            var stored = await select.ExecuteScalarAsync(cancellationToken);
            if (stored is null or DBNull)
            {
                await using var insert = new SqlCommand("INSERT INTO OrderNumberSequences (OrganizationId,BusinessDate,LastNumber) VALUES (@org,@businessDate,0);", connection, transaction);
                insert.Parameters.AddWithValue("org", organizationId);
                insert.Parameters.Add("businessDate", SqlDbType.Date).Value = businessDate.ToDateTime(TimeOnly.MinValue);
                await insert.ExecuteNonQueryAsync(cancellationToken);
                lastNumber = 0;
            }
            else
            {
                lastNumber = Convert.ToInt32(stored, System.Globalization.CultureInfo.InvariantCulture);
            }
        }

        while (lastNumber < int.MaxValue)
        {
            var candidate = lastNumber + 1;
            var number = Format(businessDate, candidate);
            await using var exists = new SqlCommand("SELECT 1 FROM Orders WITH (UPDLOCK,HOLDLOCK) WHERE OrganizationId=@org AND OrderNumber=@number;", connection, transaction);
            exists.Parameters.AddWithValue("org", organizationId);
            exists.Parameters.AddWithValue("number", number);
            if (await exists.ExecuteScalarAsync(cancellationToken) is null)
            {
                await using var update = new SqlCommand("UPDATE OrderNumberSequences SET LastNumber=@lastNumber WHERE OrganizationId=@org AND BusinessDate=@businessDate;", connection, transaction);
                update.Parameters.AddWithValue("lastNumber", candidate);
                update.Parameters.AddWithValue("org", organizationId);
                update.Parameters.Add("businessDate", SqlDbType.Date).Value = businessDate.ToDateTime(TimeOnly.MinValue);
                await update.ExecuteNonQueryAsync(cancellationToken);
                return number;
            }
            lastNumber = candidate;
        }

        throw new InvalidOperationException("The invoice number sequence is exhausted for this business date.");
    }
}
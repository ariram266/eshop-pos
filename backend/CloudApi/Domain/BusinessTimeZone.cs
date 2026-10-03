using System.Linq;

namespace Counterpoint.CloudApi.Domain;

public static class BusinessTimeZone
{
    public static TimeZoneInfo Find(string timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId)) throw new ArgumentException("A time zone is required.", nameof(timeZoneId));
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId.Trim());
        }
        catch (TimeZoneNotFoundException)
        {
            throw new ArgumentException("The time zone is not supported.", nameof(timeZoneId));
        }
        catch (InvalidTimeZoneException)
        {
            throw new ArgumentException("The time zone is not supported.", nameof(timeZoneId));
        }
    }

    public static TimeZoneInfo FindOrUtc(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId)) return TimeZoneInfo.Utc;
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId.Trim());
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    public static DateOnly Today(TimeZoneInfo timeZone) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone).DateTime);

    public static (DateTimeOffset? FromUtc, DateTimeOffset? ToUtc) GetUtcBounds(DateOnly? fromDate, DateOnly? throughDate, TimeZoneInfo timeZone)
    {
        if (fromDate.HasValue && throughDate.HasValue && throughDate.Value < fromDate.Value)
            throw new ArgumentException("The end date must not be earlier than the start date.");
        if (throughDate == DateOnly.MaxValue) throw new ArgumentException("The end date is outside the supported range.");
        return (fromDate.HasValue ? StartOfDayUtc(fromDate.Value, timeZone) : null, throughDate.HasValue ? StartOfDayUtc(throughDate.Value.AddDays(1), timeZone) : null);
    }

    private static DateTimeOffset StartOfDayUtc(DateOnly date, TimeZoneInfo timeZone)
    {
        var local = DateTime.SpecifyKind(date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified);
        while (timeZone.IsInvalidTime(local)) local = local.AddMinutes(1);
        if (timeZone.IsAmbiguousTime(local))
        {
            var offsets = timeZone.GetAmbiguousTimeOffsets(local);
            return new DateTimeOffset(local, offsets.Max()).ToUniversalTime();
        }
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, timeZone));
    }
}
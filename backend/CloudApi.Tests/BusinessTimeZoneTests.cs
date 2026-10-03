using Counterpoint.CloudApi.Domain;
using Xunit;

namespace Counterpoint.CloudApi.Tests;

public sealed class BusinessTimeZoneTests
{
    [Fact]
    public void Invoice_numbers_start_at_four_digits_and_expand_after_9999()
    {
        var businessDate = new DateOnly(2026, 10, 2);

        Assert.Equal("261002-0001", OrderNumberGenerator.Format(businessDate, 1));
        Assert.Equal("261002-9999", OrderNumberGenerator.Format(businessDate, 9999));
        Assert.Equal("261002-10000", OrderNumberGenerator.Format(businessDate, 10000));
    }

    [Fact]
    public void Invoice_numbers_reject_zero_or_negative_sequences()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => OrderNumberGenerator.Format(new DateOnly(2026, 10, 2), 0));
    }

    [Fact]
    public void Kolkata_day_bounds_convert_to_utc_without_changing_the_business_date()
    {
        var timeZone = BusinessTimeZone.Find("Asia/Kolkata");
        var bounds = BusinessTimeZone.GetUtcBounds(new DateOnly(2026, 10, 2), new DateOnly(2026, 10, 2), timeZone);

        Assert.Equal(new DateTimeOffset(2026, 10, 1, 18, 30, 0, TimeSpan.Zero), bounds.FromUtc);
        Assert.Equal(new DateTimeOffset(2026, 10, 2, 18, 30, 0, TimeSpan.Zero), bounds.ToUtc);
    }

    [Fact]
    public void Date_bounds_account_for_daylight_saving_transitions()
    {
        var timeZone = BusinessTimeZone.Find("America/Chicago");
        var bounds = BusinessTimeZone.GetUtcBounds(new DateOnly(2026, 3, 8), new DateOnly(2026, 3, 8), timeZone);

        Assert.Equal(new DateTimeOffset(2026, 3, 8, 6, 0, 0, TimeSpan.Zero), bounds.FromUtc);
        Assert.Equal(new DateTimeOffset(2026, 3, 9, 5, 0, 0, TimeSpan.Zero), bounds.ToUtc);
    }

    [Fact]
    public void Rejects_an_unknown_timezone_identifier()
    {
        Assert.Throws<ArgumentException>(() => BusinessTimeZone.Find("Not/A_Time_Zone"));
    }
}
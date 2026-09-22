using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Xunit;
using Microsoft.Extensions.Configuration;

namespace Counterpoint.CloudApi.Tests;

public sealed class AuthorizationServiceTests
{
    [Fact]
    public void Cashier_can_access_pos()
    {
        var actor = new ActorContext(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Cashier", "Cashier");
        new AuthorizationService(null!, new ConfigurationBuilder().Build()).Require(actor, "Cashier");
    }

    [Fact]
    public void Cashier_cannot_access_kds()
    {
        var actor = new ActorContext(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Cashier", "Cashier");
        Assert.Throws<ForbiddenException>(() => new AuthorizationService(null!, new ConfigurationBuilder().Build()).Require(actor, "KitchenStaff"));
    }
}

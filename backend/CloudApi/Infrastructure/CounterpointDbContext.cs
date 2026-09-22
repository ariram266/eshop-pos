using Microsoft.EntityFrameworkCore;

namespace Counterpoint.CloudApi.Infrastructure;

public sealed class CounterpointDbContext(DbContextOptions<CounterpointDbContext> options) : DbContext(options)
{
    public DbSet<OrganizationEntity> Organizations => Set<OrganizationEntity>();
    public DbSet<LocationEntity> Locations => Set<LocationEntity>();
    public DbSet<ProductEntity> Products => Set<ProductEntity>();
    public DbSet<InventoryBalanceEntity> InventoryBalances => Set<InventoryBalanceEntity>();
    public DbSet<OrderEntity> Orders => Set<OrderEntity>();
    public DbSet<KdsWorkItemEntity> KdsWorkItems => Set<KdsWorkItemEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<OrganizationEntity>().ToTable("Organizations").HasKey(entity => entity.Id);
        modelBuilder.Entity<LocationEntity>().ToTable("Locations").HasKey(entity => entity.Id);
        modelBuilder.Entity<ProductEntity>().ToTable("Products").HasKey(entity => entity.Id);
        modelBuilder.Entity<InventoryBalanceEntity>().ToTable("InventoryBalances").HasKey(entity => new { entity.OrganizationId, entity.LocationId, entity.ProductId });
        modelBuilder.Entity<OrderEntity>().ToTable("Orders").HasKey(entity => entity.Id);
        modelBuilder.Entity<KdsWorkItemEntity>().ToTable("KdsWorkItems").HasKey(entity => entity.Id);
        modelBuilder.Entity<ProductEntity>().Property(entity => entity.Price).HasPrecision(19, 4);
        modelBuilder.Entity<InventoryBalanceEntity>().Property(entity => entity.OnHand).HasPrecision(19, 4);
        modelBuilder.Entity<OrderEntity>().Property(entity => entity.Total).HasPrecision(19, 4);
    }
}

public sealed class OrganizationEntity { public Guid Id { get; set; } public string Name { get; set; } = ""; }
public sealed class LocationEntity { public Guid Id { get; set; } public Guid OrganizationId { get; set; } public string Name { get; set; } = ""; }
public sealed class ProductEntity { public Guid Id { get; set; } public Guid OrganizationId { get; set; } public string Sku { get; set; } = ""; public string Name { get; set; } = ""; public decimal Price { get; set; } }
public sealed class InventoryBalanceEntity { public Guid OrganizationId { get; set; } public Guid LocationId { get; set; } public Guid ProductId { get; set; } public decimal OnHand { get; set; } }
public sealed class OrderEntity { public Guid Id { get; set; } public Guid OrganizationId { get; set; } public Guid LocationId { get; set; } public decimal Total { get; set; } }
public sealed class KdsWorkItemEntity { public Guid Id { get; set; } public Guid OrganizationId { get; set; } public Guid LocationId { get; set; } public string Status { get; set; } = ""; }

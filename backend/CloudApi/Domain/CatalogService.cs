using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.Contracts;
using Microsoft.Data.SqlClient;

namespace Counterpoint.CloudApi.Domain;

public sealed class CatalogService(SqlConnectionFactory connections)
{
    public async Task<CategoryDto> CreateCategoryAsync(ActorContext actor, CreateCategoryRequest input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("Category name is required.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        var id = Guid.NewGuid();
        await using var command = new SqlCommand("IF @parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Categories WHERE Id=@parent AND OrganizationId=@org AND Active=1) THROW 50001, 'Parent category is not available.', 1; INSERT INTO Categories (Id,OrganizationId,Name,ParentId) VALUES (@id,@org,@name,@parent);", connection);
        command.Parameters.AddWithValue("id", id); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("name", input.Name.Trim()); command.Parameters.AddWithValue("parent", (object?)input.ParentId ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return new(id, input.Name.Trim(), input.ParentId, true);
    }

    public async Task<CategoryDto> UpdateCategoryAsync(ActorContext actor, Guid categoryId, UpdateCategoryRequest input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("Category name is required.");
        if (input.ParentId == categoryId) throw new ArgumentException("A category cannot be its own parent.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("IF @parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Categories WHERE Id=@parent AND OrganizationId=@org AND Active=1) THROW 50001, 'Parent category is not available.', 1; UPDATE Categories SET Name=@name,ParentId=@parent,Active=@active WHERE Id=@id AND OrganizationId=@org;", connection);
        command.Parameters.AddWithValue("id", categoryId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("name", input.Name.Trim()); command.Parameters.AddWithValue("parent", (object?)input.ParentId ?? DBNull.Value); command.Parameters.AddWithValue("active", input.Active);
        if (await command.ExecuteNonQueryAsync(cancellationToken) == 0) throw new KeyNotFoundException("Category was not found.");
        return new(categoryId, input.Name.Trim(), input.ParentId, input.Active);
    }

    public async Task<CatalogProductDto> CreateProductAsync(ActorContext actor, CreateProductRequest input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Sku) || string.IsNullOrWhiteSpace(input.Name) || input.Price < 0 || string.IsNullOrWhiteSpace(input.Unit)) throw new ArgumentException("SKU, name, unit, and non-negative price are required.");
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken); await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
        await using var category = new SqlCommand("SELECT 1 FROM Categories WHERE Id=@category AND OrganizationId=@org AND Active=1;", connection, transaction);
        category.Parameters.AddWithValue("category", input.CategoryId); category.Parameters.AddWithValue("org", actor.OrganizationId);
        if (await category.ExecuteScalarAsync(cancellationToken) is null) throw new ArgumentException("Category is not available in this organization.");
        var id = Guid.NewGuid();
        await using (var product = new SqlCommand("INSERT INTO Products (Id,OrganizationId,CategoryId,TaxRuleId,PreparationStationId,Sku,Name,Unit,ProductType,HsnCode,GstRate,TrackInventory) VALUES (@id,@org,@category,@tax,@station,@sku,@name,@unit,@type,@hsn,@gst,@track); INSERT INTO ProductPrices (Id,OrganizationId,ProductId,LocationId,Price) VALUES (NEWID(),@org,@id,@location,@price); IF @track=1 INSERT INTO InventoryBalances (OrganizationId,LocationId,ProductId,OnHand,ReorderLevel) VALUES (@org,@location,@id,0,0);", connection, transaction))
        {
            product.Parameters.AddWithValue("id", id); product.Parameters.AddWithValue("org", actor.OrganizationId); product.Parameters.AddWithValue("category", input.CategoryId); product.Parameters.AddWithValue("tax", (object?)input.TaxRuleId ?? DBNull.Value); product.Parameters.AddWithValue("station", (object?)input.PreparationStationId ?? DBNull.Value); product.Parameters.AddWithValue("sku", input.Sku.Trim()); product.Parameters.AddWithValue("name", input.Name.Trim()); product.Parameters.AddWithValue("unit", input.Unit.Trim()); product.Parameters.AddWithValue("type", input.ProductType.Trim().ToUpperInvariant()); product.Parameters.AddWithValue("hsn", (object?)input.HsnCode ?? DBNull.Value); product.Parameters.AddWithValue("gst", input.GstRate); product.Parameters.AddWithValue("track", input.TrackInventory); product.Parameters.AddWithValue("location", actor.LocationId); product.Parameters.AddWithValue("price", input.Price); await product.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return new(id, input.Sku.Trim(), input.Name.Trim(), input.CategoryId, input.Price, input.Unit.Trim(), input.ProductType.Trim().ToUpperInvariant(), true, input.TrackInventory);
    }

    public async Task<CatalogProductDto> UpdateProductAsync(ActorContext actor, Guid productId, UpdateProductRequest input, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create(); await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("UPDATE Products SET Sku=@sku,Name=@name,CategoryId=@category,Unit=@unit,ProductType=@type,HsnCode=@hsn,GstRate=@gst,Active=@active,TrackInventory=@track,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id AND OrganizationId=@org; UPDATE ProductPrices SET Price=@price WHERE ProductId=@id AND OrganizationId=@org AND LocationId=@location AND Active=1;", connection);
        command.Parameters.AddWithValue("id", productId); command.Parameters.AddWithValue("org", actor.OrganizationId); command.Parameters.AddWithValue("location", actor.LocationId); command.Parameters.AddWithValue("sku", input.Sku.Trim()); command.Parameters.AddWithValue("name", input.Name.Trim()); command.Parameters.AddWithValue("category", input.CategoryId); command.Parameters.AddWithValue("unit", input.Unit.Trim()); command.Parameters.AddWithValue("type", input.ProductType.Trim().ToUpperInvariant()); command.Parameters.AddWithValue("hsn", (object?)input.HsnCode ?? DBNull.Value); command.Parameters.AddWithValue("gst", input.GstRate); command.Parameters.AddWithValue("active", input.Active); command.Parameters.AddWithValue("track", input.TrackInventory); command.Parameters.AddWithValue("price", input.Price);
        if (await command.ExecuteNonQueryAsync(cancellationToken) < 1) throw new KeyNotFoundException("Product was not found.");
        return new(productId, input.Sku.Trim(), input.Name.Trim(), input.CategoryId, input.Price, input.Unit.Trim(), input.ProductType.Trim().ToUpperInvariant(), input.Active, input.TrackInventory);
    }
}

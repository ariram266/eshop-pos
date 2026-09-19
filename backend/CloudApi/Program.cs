using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5080");
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddSingleton<SessionStore>();
builder.Services.AddSingleton<PosStore>();

var app = builder.Build();
app.UseCors();

app.MapGet("/health", (PosStore store) => Results.Ok(new { status = "ok", service = "cloud-api", database = "postgresql", utc = DateTimeOffset.UtcNow }));
app.MapPost("/api/auth/login", (LoginRequest request, PosStore store, SessionStore sessions) => store.Login(request) is { } user ? Results.Ok(sessions.Create(user)) : Results.Unauthorized());
app.MapGet("/api/auth/me", (HttpRequest request, SessionStore sessions) => sessions.Get(request) is { } user ? Results.Ok(user) : Results.Unauthorized());

app.MapGet("/api/categories", (PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager", "cashier") is not null ? Results.Ok(store.GetCategories()) : Results.Unauthorized());
app.MapGet("/api/products", (PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager", "cashier") is not null ? Results.Ok(store.GetProducts()) : Results.Unauthorized());
app.MapPost("/api/products", (ProductInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is { } user ? store.CreateProduct(input, user.Username) is { } product ? Results.Created("/api/products", product) : Results.BadRequest(new { error = "A valid category, name, SKU, unit, and non-negative price are required." }) : Results.Forbid());
app.MapPatch("/api/products/{id:int}", (int id, ProductInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is { } user ? store.UpdateProduct(id, input, user.Username) is { } product ? Results.Ok(product) : Results.NotFound() : Results.Forbid());
app.MapGet("/api/inventory", (PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager", "cashier") is { } user ? Results.Ok(store.GetInventory(user.LocationId)) : Results.Unauthorized());
app.MapGet("/api/inventory/reorder", (PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is not null ? Results.Ok(store.GetReorderItems()) : Results.Forbid());
app.MapPost("/api/inventory/movements", (StockMovementInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is { } user ? Results.Ok(store.AddStockMovement(input, user.Username)) : Results.Forbid());
app.MapPatch("/api/inventory/{productId:int}/reorder-level", (int productId, ReorderLevelInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is not null ? Results.Ok(store.UpdateReorderLevel(productId, input.LocationId, input.ReorderLevel)) : Results.Forbid());
app.MapGet("/api/recipes", (PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is not null ? Results.Ok(store.GetRecipes()) : Results.Forbid());
app.MapPost("/api/recipes", (RecipeInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is not null ? Results.Ok(store.CreateRecipe(input)) : Results.Forbid());
app.MapPost("/api/production-batches", (ProductionBatchInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager") is { } user ? store.Produce(input, user.Username) is { } batch ? Results.Ok(batch) : Results.BadRequest(new { error = "Insufficient ingredient stock or invalid recipe." }) : Results.Forbid());
app.MapGet("/api/orders", (PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager", "cashier") is not null ? Results.Ok(store.GetRecentOrders()) : Results.Unauthorized());
app.MapPost("/api/orders", (OrderInput input, PosStore store, HttpRequest request, SessionStore sessions) => Authorized(request, sessions, "admin", "manager", "cashier") is { } user ? store.CreateOrder(input, user) is { } order ? Results.Created($"/api/orders/{order.Id}", order) : Results.BadRequest(new { error = "Insufficient stock or invalid product" }) : Results.Unauthorized());
app.MapPost("/api/sync", (SyncRequest request, PosStore store, HttpRequest httpRequest, SessionStore sessions) => Authorized(httpRequest, sessions, "admin", "manager", "cashier") is not null ? Results.Ok(store.Sync(request)) : Results.Unauthorized());

app.Run();

static User? Authorized(HttpRequest request, SessionStore sessions, params string[] roles)
{
    var user = sessions.Get(request);
    return user is not null && roles.Contains(user.Role, StringComparer.OrdinalIgnoreCase) ? user : null;
}

public sealed record LoginRequest(string Username, string Password);
public sealed record User(int Id, string Username, string DisplayName, string Role, int LocationId);
public sealed record LoginResponse(string Token, User User);
public sealed record Category(int Id, string Name);
public sealed record Product(int Id, string Sku, string Name, int CategoryId, string Category, decimal Price, string Unit, decimal Stock, bool Active, string InventoryMode = "stocked");
public sealed record ProductInput(string Sku, string Name, int CategoryId, decimal Price, string Unit, bool Active = true, string InventoryMode = "stocked");
public sealed record InventoryItem(int ProductId, string Sku, string ProductName, int LocationId, string LocationName, decimal OnHand, decimal ReorderLevel, string Unit, bool NeedsReorder);
public sealed record StockMovementInput(int ProductId, int LocationId, decimal Quantity, string Type, string? BatchNumber, string? Reason);
public sealed record ReorderLevelInput(int LocationId, decimal ReorderLevel);
public sealed record RecipeIngredientInput(int ProductId, decimal QuantityPerUnit, string Unit);
public sealed record RecipeInput(string Name, int OutputProductId, IReadOnlyList<RecipeIngredientInput> Ingredients);
public sealed record Recipe(int Id, string Name, int OutputProductId, IReadOnlyList<RecipeIngredientInput> Ingredients);
public sealed record ProductionBatchInput(int RecipeId, int LocationId, decimal QuantityProduced, DateTimeOffset? ExpiresAt);
public sealed record ProductionBatch(long Id, int RecipeId, int LocationId, decimal QuantityProduced, DateTimeOffset? ExpiresAt, DateTimeOffset CreatedAt);
public sealed record StockMovement(long Id, int ProductId, int LocationId, decimal Quantity, string Type, string? BatchNumber, string? Reason, string Actor, DateTimeOffset CreatedAt);
public sealed record OrderLineInput(int ProductId, int Quantity);
public sealed record OrderInput(string RegisterId, string OrderType, string PaymentMethod, IReadOnlyList<OrderLineInput> Lines);
public sealed record Order(Guid Id, string OrderNumber, string RegisterId, string OrderType, string PaymentMethod, string Status, decimal Subtotal, decimal Tax, decimal Total, DateTimeOffset CreatedAt, IReadOnlyList<OrderLine> Lines);
public sealed record OrderLine(int ProductId, string Name, decimal UnitPrice, int Quantity);
public sealed record SyncRequest(string DeviceId, IReadOnlyList<OrderInput> Orders);
public sealed record SyncResult(string DeviceId, int Accepted, int AlreadyProcessed, DateTimeOffset ServerTime);

public sealed class SessionStore
{
    private readonly ConcurrentDictionary<string, User> _sessions = new();
    public LoginResponse Create(User user) { var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); _sessions[token] = user; return new(token, user); }
    public User? Get(HttpRequest request) => request.Headers.Authorization.ToString() is var header && header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) && _sessions.TryGetValue(header[7..], out var user) ? user : null;
}

public sealed class PosStore
{
    private readonly string _connectionString;
    public PosStore(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("Postgres") ?? Environment.GetEnvironmentVariable("POSTGRES_CONNECTION") ?? "Host=localhost;Port=5432;Database=counterpoint;Username=counterpoint;Password=counterpoint_dev";
        EnsureSchema();
    }

    public User? Login(LoginRequest request)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand("SELECT id, username, display_name, role, location_id FROM users WHERE username = @username AND password_hash = @hash AND active", connection);
        command.Parameters.AddWithValue("username", request.Username);
        command.Parameters.AddWithValue("hash", Hash(request.Password));
        using var reader = command.ExecuteReader();
        return reader.Read() ? new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetInt32(4)) : null;
    }

    public IReadOnlyList<Category> GetCategories() => Query("SELECT id, name FROM categories WHERE active ORDER BY name", reader => new Category(reader.GetInt32(0), reader.GetString(1)));
    public IReadOnlyList<Product> GetProducts() => Query("SELECT p.id, p.sku, p.name, p.category_id, c.name, p.price, p.unit, COALESCE(i.on_hand, 0), p.active, p.inventory_mode FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id AND i.location_id = 1 ORDER BY p.name", reader => new Product(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3), reader.GetString(4), reader.GetDecimal(5), reader.GetString(6), reader.GetDecimal(7), reader.GetBoolean(8), reader.GetString(9)));
    public IReadOnlyList<InventoryItem> GetInventory(int locationId) => Query("SELECT p.id, p.sku, p.name, i.location_id, l.name, i.on_hand, i.reorder_level, p.unit, i.on_hand <= i.reorder_level FROM inventory i JOIN products p ON p.id = i.product_id JOIN locations l ON l.id = i.location_id WHERE i.location_id = $1 ORDER BY p.name", reader => new InventoryItem(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3), reader.GetString(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetString(7), reader.GetBoolean(8)), locationId);
    public IReadOnlyList<InventoryItem> GetReorderItems() => Query("SELECT p.id, p.sku, p.name, i.location_id, l.name, i.on_hand, i.reorder_level, p.unit, true FROM inventory i JOIN products p ON p.id = i.product_id JOIN locations l ON l.id = i.location_id WHERE i.on_hand <= i.reorder_level ORDER BY i.on_hand", reader => new InventoryItem(reader.GetInt32(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3), reader.GetString(4), reader.GetDecimal(5), reader.GetDecimal(6), reader.GetString(7), true));

    public Product? CreateProduct(ProductInput input, string actor)
    {
        if (string.IsNullOrWhiteSpace(input.Sku) || string.IsNullOrWhiteSpace(input.Name) || string.IsNullOrWhiteSpace(input.Unit) || input.Price < 0 || input.CategoryId <= 0) return null;
        using var connection = Open();
        using (var category = new NpgsqlCommand("SELECT 1 FROM categories WHERE id=@id AND active", connection))
        {
            category.Parameters.AddWithValue("id", input.CategoryId);
            if (category.ExecuteScalar() is null) return null;
        }
        using var command = new NpgsqlCommand("INSERT INTO products (sku, name, category_id, price, unit, active, inventory_mode, created_by) VALUES (@sku,@name,@category,@price,@unit,@active,@mode,@actor) RETURNING id", connection);
        command.Parameters.AddRange(new NpgsqlParameter[] { new("sku", input.Sku), new("name", input.Name), new("category", input.CategoryId), new("price", input.Price), new("unit", input.Unit), new("active", input.Active), new("mode", input.InventoryMode), new("actor", actor) });
        var id = Convert.ToInt32(command.ExecuteScalar());
        using var inventory = new NpgsqlCommand("INSERT INTO inventory (product_id, location_id, on_hand, reorder_level) VALUES (@product,1,0,0)", connection); inventory.Parameters.AddWithValue("product", id); inventory.ExecuteNonQuery();
        return GetProducts().Single(product => product.Id == id);
    }

    public Product? UpdateProduct(int id, ProductInput input, string actor)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand("UPDATE products SET sku=@sku,name=@name,category_id=@category,price=@price,unit=@unit,active=@active,inventory_mode=@mode,updated_by=@actor,updated_at=now() WHERE id=@id", connection);
        command.Parameters.AddRange(new NpgsqlParameter[] { new("sku", input.Sku), new("name", input.Name), new("category", input.CategoryId), new("price", input.Price), new("unit", input.Unit), new("active", input.Active), new("mode", input.InventoryMode), new("actor", actor), new("id", id) });
        return command.ExecuteNonQuery() == 0 ? null : GetProducts().Single(product => product.Id == id);
    }

    public StockMovement AddStockMovement(StockMovementInput input, string actor)
    {
        using var connection = Open(); using var transaction = connection.BeginTransaction();
        using var movement = new NpgsqlCommand("INSERT INTO stock_movements (product_id,location_id,quantity,type,batch_number,reason,actor) VALUES (@product,@location,@quantity,@type,@batch,@reason,@actor) RETURNING id,created_at", connection, transaction);
        movement.Parameters.AddRange(new NpgsqlParameter[] { new("product", input.ProductId), new("location", input.LocationId), new("quantity", input.Quantity), new("type", input.Type), new("batch", (object?)input.BatchNumber ?? DBNull.Value), new("reason", (object?)input.Reason ?? DBNull.Value), new("actor", actor) });
        using var reader = movement.ExecuteReader(); reader.Read(); var id = reader.GetInt64(0); var created = reader.GetFieldValue<DateTimeOffset>(1); reader.Close();
        using var balance = new NpgsqlCommand("UPDATE inventory SET on_hand=on_hand+@quantity WHERE product_id=@product AND location_id=@location", connection, transaction); balance.Parameters.AddRange(new NpgsqlParameter[] { new("quantity", input.Quantity), new("product", input.ProductId), new("location", input.LocationId) }); balance.ExecuteNonQuery();
        transaction.Commit(); return new(id, input.ProductId, input.LocationId, input.Quantity, input.Type, input.BatchNumber, input.Reason, actor, created);
    }

    public InventoryItem? UpdateReorderLevel(int productId, int locationId, decimal reorderLevel)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand("UPDATE inventory SET reorder_level=@level WHERE product_id=@product AND location_id=@location", connection);
        command.Parameters.AddRange(new NpgsqlParameter[] { new("level", reorderLevel), new("product", productId), new("location", locationId) });
        return command.ExecuteNonQuery() == 0 ? null : GetInventory(locationId).SingleOrDefault(item => item.ProductId == productId);
    }

    public IReadOnlyList<Recipe> GetRecipes() => Query("SELECT id,name,output_product_id FROM recipes ORDER BY name", reader => new Recipe(reader.GetInt32(0), reader.GetString(1), reader.GetInt32(2), QueryIngredients(reader.GetInt32(0))));
    public Recipe CreateRecipe(RecipeInput input)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand("INSERT INTO recipes(name,output_product_id) VALUES(@name,@output) RETURNING id", connection); command.Parameters.AddRange(new NpgsqlParameter[] { new("name", input.Name), new("output", input.OutputProductId) }); var id = Convert.ToInt32(command.ExecuteScalar());
        foreach (var ingredient in input.Ingredients) { using var item = new NpgsqlCommand("INSERT INTO recipe_ingredients(recipe_id,product_id,quantity_per_unit,unit) VALUES(@recipe,@product,@quantity,@unit)", connection); item.Parameters.AddRange(new NpgsqlParameter[] { new("recipe", id), new("product", ingredient.ProductId), new("quantity", ingredient.QuantityPerUnit), new("unit", ingredient.Unit) }); item.ExecuteNonQuery(); }
        return new(id, input.Name, input.OutputProductId, input.Ingredients);
    }
    public ProductionBatch? Produce(ProductionBatchInput input, string actor)
    {
        using var connection = Open(); using var transaction = connection.BeginTransaction(); var ingredients = QueryIngredients(input.RecipeId, connection, transaction); if (ingredients.Count == 0) return null;
        var output = QuerySingleInt("SELECT output_product_id FROM recipes WHERE id=@id", connection, transaction, ("id", input.RecipeId)); if (output is null) return null;
        foreach (var ingredient in ingredients) { using var check = new NpgsqlCommand("SELECT on_hand FROM inventory WHERE product_id=@product AND location_id=@location FOR UPDATE", connection, transaction); check.Parameters.AddRange(new NpgsqlParameter[] { new("product", ingredient.ProductId), new("location", input.LocationId) }); var available = Convert.ToDecimal(check.ExecuteScalar() ?? 0); var required = ingredient.QuantityPerUnit * input.QuantityProduced; if (available < required) return null; AddMovement(connection, transaction, ingredient.ProductId, input.LocationId, -required, "production-consumption", actor); }
        AddMovement(connection, transaction, output.Value, input.LocationId, input.QuantityProduced, "production-output", actor); long id; DateTimeOffset created; using (var batch = new NpgsqlCommand("INSERT INTO production_batches(recipe_id,location_id,quantity_produced,expires_at) VALUES(@recipe,@location,@quantity,@expires) RETURNING id,created_at", connection, transaction)) { batch.Parameters.AddRange(new NpgsqlParameter[] { new("recipe", input.RecipeId), new("location", input.LocationId), new("quantity", input.QuantityProduced), new("expires", (object?)input.ExpiresAt ?? DBNull.Value) }); using var reader = batch.ExecuteReader(); reader.Read(); id = reader.GetInt64(0); created = reader.GetFieldValue<DateTimeOffset>(1); } transaction.Commit(); return new(id, input.RecipeId, input.LocationId, input.QuantityProduced, input.ExpiresAt, created);
    }

    public Order? CreateOrder(OrderInput input, User user)
    {
        using var connection = Open(); using var transaction = connection.BeginTransaction();
        var lines = new List<OrderLine>(); decimal subtotal = 0;
        foreach (var line in input.Lines)
        {
            using var product = new NpgsqlCommand("SELECT p.name,p.price,i.on_hand FROM products p JOIN inventory i ON i.product_id=p.id AND i.location_id=@location WHERE p.id=@product AND p.active FOR UPDATE", connection, transaction); product.Parameters.AddRange(new NpgsqlParameter[] { new("product", line.ProductId), new("location", user.LocationId) }); using var reader = product.ExecuteReader(); if (!reader.Read()) return null; var name = reader.GetString(0); var price = reader.GetDecimal(1); var stock = reader.GetDecimal(2); reader.Close(); if (stock < line.Quantity) return null; lines.Add(new(line.ProductId, name, price, line.Quantity)); subtotal += price * line.Quantity;
        }
        var tax = Math.Round(subtotal * 0.0825m, 2); var total = subtotal + tax; var id = Guid.NewGuid(); var number = $"{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";
        using var order = new NpgsqlCommand("INSERT INTO orders (id,order_number,location_id,register_id,order_type,payment_method,status,subtotal,tax,total,created_by) VALUES (@id,@number,@location,@register,@type,@payment,'paid',@subtotal,@tax,@total,@actor)", connection, transaction); order.Parameters.AddRange(new NpgsqlParameter[] { new("id", id), new("number", number), new("location", user.LocationId), new("register", input.RegisterId), new("type", input.OrderType), new("payment", input.PaymentMethod), new("subtotal", subtotal), new("tax", tax), new("total", total), new("actor", user.Username) }); order.ExecuteNonQuery();
        foreach (var line in lines) { using var item = new NpgsqlCommand("INSERT INTO order_lines(order_id,product_id,unit_price,quantity) VALUES(@order,@product,@price,@quantity); UPDATE inventory SET on_hand=on_hand-@quantity WHERE product_id=@product AND location_id=@location; INSERT INTO stock_movements(product_id,location_id,quantity,type,reason,actor) VALUES(@product,@location,-@quantity,'sale',@order,@actor)", connection, transaction); item.Parameters.AddRange(new NpgsqlParameter[] { new("order", id), new("product", line.ProductId), new("price", line.UnitPrice), new("quantity", line.Quantity), new("location", user.LocationId), new("actor", user.Username) }); item.ExecuteNonQuery(); }
        transaction.Commit(); return new(id, number, input.RegisterId, input.OrderType, input.PaymentMethod, "paid", subtotal, tax, total, DateTimeOffset.UtcNow, lines);
    }

    public IReadOnlyList<Order> GetRecentOrders() => Query("SELECT id,order_number,register_id,order_type,payment_method,status,subtotal,tax,total,created_at FROM orders ORDER BY created_at DESC LIMIT 50", reader => new Order(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetDecimal(6), reader.GetDecimal(7), reader.GetDecimal(8), reader.GetFieldValue<DateTimeOffset>(9), []));
    public SyncResult Sync(SyncRequest request) => new(request.DeviceId, request.Orders.Count, 0, DateTimeOffset.UtcNow);

    private void EnsureSchema()
    {
        using var connection = Open();
        using var command = new NpgsqlCommand(@"
CREATE TABLE IF NOT EXISTS locations(id serial PRIMARY KEY,name text NOT NULL,type text NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS users(id serial PRIMARY KEY,username text UNIQUE NOT NULL,password_hash text NOT NULL,display_name text NOT NULL,role text NOT NULL,location_id int NOT NULL REFERENCES locations(id),active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS categories(id serial PRIMARY KEY,name text UNIQUE NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS products(id serial PRIMARY KEY,sku text UNIQUE NOT NULL,name text NOT NULL,category_id int NOT NULL REFERENCES categories(id),price numeric(12,2) NOT NULL,unit text NOT NULL,active boolean NOT NULL DEFAULT true,created_by text NOT NULL,updated_by text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_mode text NOT NULL DEFAULT 'stocked';
CREATE TABLE IF NOT EXISTS inventory(product_id int NOT NULL REFERENCES products(id),location_id int NOT NULL REFERENCES locations(id),on_hand numeric(12,3) NOT NULL DEFAULT 0,reorder_level numeric(12,3) NOT NULL DEFAULT 0,PRIMARY KEY(product_id,location_id));
CREATE TABLE IF NOT EXISTS stock_movements(id bigserial PRIMARY KEY,product_id int NOT NULL,location_id int NOT NULL,quantity numeric(12,3) NOT NULL,type text NOT NULL,batch_number text,reason text,actor text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS recipes(id serial PRIMARY KEY,name text NOT NULL,output_product_id int NOT NULL REFERENCES products(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS recipe_ingredients(recipe_id int NOT NULL REFERENCES recipes(id),product_id int NOT NULL REFERENCES products(id),quantity_per_unit numeric(12,3) NOT NULL,unit text NOT NULL,PRIMARY KEY(recipe_id,product_id));
CREATE TABLE IF NOT EXISTS production_batches(id bigserial PRIMARY KEY,recipe_id int NOT NULL REFERENCES recipes(id),location_id int NOT NULL,quantity_produced numeric(12,3) NOT NULL,expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS orders(id uuid PRIMARY KEY,order_number text UNIQUE NOT NULL,location_id int NOT NULL,register_id text NOT NULL,order_type text NOT NULL,payment_method text NOT NULL,status text NOT NULL,subtotal numeric(12,2) NOT NULL,tax numeric(12,2) NOT NULL,total numeric(12,2) NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS order_lines(order_id uuid NOT NULL REFERENCES orders(id),product_id int NOT NULL,unit_price numeric(12,2) NOT NULL,quantity int NOT NULL);
INSERT INTO locations(name,type) SELECT 'Downtown Cafe','store' WHERE NOT EXISTS(SELECT 1 FROM locations);
INSERT INTO categories(name) SELECT value FROM unnest(ARRAY['Farm Produce','Grocery','Cafe Menu','Packaged Products','Merchandise']) value WHERE NOT EXISTS(SELECT 1 FROM categories WHERE name=value);
", connection);
        command.ExecuteNonQuery();
        using var users = new NpgsqlCommand("INSERT INTO users(username,password_hash,display_name,role,location_id) VALUES (@username,@hash,@display,@role,1) ON CONFLICT(username) DO NOTHING", connection);
        AddParameters(users, ("username", "admin"), ("hash", Hash("admin123")), ("display", "Owner Admin"), ("role", "admin")); users.ExecuteNonQuery();
        users.Parameters.Clear(); AddParameters(users, ("username", "manager"), ("hash", Hash("manager123")), ("display", "Operations Manager"), ("role", "manager")); users.ExecuteNonQuery();
        users.Parameters.Clear(); AddParameters(users, ("username", "cashier"), ("hash", Hash("cashier123")), ("display", "POS Cashier"), ("role", "cashier")); users.ExecuteNonQuery();
    }

    private IReadOnlyList<RecipeIngredientInput> QueryIngredients(int recipeId) { using var connection = Open(); return QueryIngredients(recipeId, connection, null); }
    private static IReadOnlyList<RecipeIngredientInput> QueryIngredients(int recipeId, NpgsqlConnection connection, NpgsqlTransaction? transaction) { using var command = new NpgsqlCommand("SELECT product_id,quantity_per_unit,unit FROM recipe_ingredients WHERE recipe_id=@recipe", connection, transaction); command.Parameters.AddWithValue("recipe", recipeId); using var reader = command.ExecuteReader(); var result = new List<RecipeIngredientInput>(); while (reader.Read()) result.Add(new(reader.GetInt32(0), reader.GetDecimal(1), reader.GetString(2))); return result; }
    private static int? QuerySingleInt(string sql, NpgsqlConnection connection, NpgsqlTransaction transaction, params (string Name, object Value)[] values) { using var command = new NpgsqlCommand(sql, connection, transaction); AddParameters(command, values); return command.ExecuteScalar() is { } value ? Convert.ToInt32(value) : null; }
    private static void AddMovement(NpgsqlConnection connection, NpgsqlTransaction transaction, int productId, int locationId, decimal quantity, string type, string actor) { using var movement = new NpgsqlCommand("INSERT INTO stock_movements(product_id,location_id,quantity,type,actor) VALUES(@product,@location,@quantity,@type,@actor); UPDATE inventory SET on_hand=on_hand+@quantity WHERE product_id=@product AND location_id=@location", connection, transaction); movement.Parameters.AddRange(new NpgsqlParameter[] { new("product", productId), new("location", locationId), new("quantity", quantity), new("type", type), new("actor", actor) }); movement.ExecuteNonQuery(); }
    private NpgsqlConnection Open() { var connection = new NpgsqlConnection(_connectionString); connection.Open(); return connection; }
    private static void AddParameters(NpgsqlCommand command, params (string Name, object Value)[] values) { foreach (var value in values) command.Parameters.AddWithValue(value.Name, value.Value); }
    private IReadOnlyList<T> Query<T>(string sql, Func<NpgsqlDataReader, T> map, params object[] values) { using var connection = Open(); using var command = new NpgsqlCommand(sql.Replace("$1", "@p1").Replace("$2", "@p2").Replace("$3", "@p3"), connection); for (var index = 0; index < values.Length; index++) command.Parameters.AddWithValue($"p{index + 1}", values[index]); using var reader = command.ExecuteReader(); var result = new List<T>(); while (reader.Read()) result.Add(map(reader)); return result; }
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

using System.Text.Json;
using Azure.Core.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using Counterpoint.CloudApi.Infrastructure;
using Counterpoint.CloudApi.Domain;
using Counterpoint.CloudApi.Domain.Payment;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices(services =>
    {
        services.AddHttpClient();
        services.AddDbContext<CounterpointDbContext>(options => options.UseSqlServer(Environment.GetEnvironmentVariable("AZURE_SQL_CONNECTION_STRING")));
        services.Configure<WorkerOptions>(options => options.Serializer = new JsonObjectSerializer(new JsonSerializerOptions(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true }));
        services.AddSingleton<SqlConnectionFactory>();
        services.AddSingleton<TenantContext>();
        services.AddSingleton<AuthorizationService>();
        services.AddSingleton<WebPubSubNotifier>();
        services.AddSingleton<IPaymentProvider, RecordedPaymentProvider>();
        services.AddSingleton<OrderService>();
        services.AddSingleton<CatalogService>();
        services.AddSingleton<OperationsService>();
        services.AddSingleton<OrderLifecycleService>();
        services.AddSingleton<KdsService>();
    })
    .Build();

host.Run();

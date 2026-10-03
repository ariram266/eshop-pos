import { Fragment, useEffect, useState } from "react";
import {
  createSupplier,
  fetchInventory,
  fetchPurchases,
  fetchSalesHistory,
  fetchSalesSummary,
  fetchStockMovements,
  fetchSuppliers,
  receivePurchase,
  updateKdsSettings,
  updateOrganizationTimeZone,
  updatePurchase,
  updateSupplier,
  type InventorySummary,
  type PosBootstrap,
  type Product,
  type Purchase,
  type SalesHistory,
  type SalesSummary,
  type StockMovement,
  type Supplier,
} from "./lib/api";

type SupplierForm = {
  code: string;
  name: string;
  email: string;
  phone: string;
};
type PurchaseForm = {
  supplierId: string;
  lines: PurchaseFormLine[];
  reference: string;
};
type PurchaseFormLine = {
  productId: string;
  productSearch: string;
  quantity: string;
  unitCost: string;
};
type Period = "" | "today" | "week" | "month" | "custom";

const emptySupplierForm = (): SupplierForm => ({
  code: "",
  name: "",
  email: "",
  phone: "",
});
const emptyPurchaseLine = (): PurchaseFormLine => ({
  productId: "",
  productSearch: "",
  quantity: "",
  unitCost: "",
});
const emptyPurchaseForm = (): PurchaseForm => ({
  supplierId: "",
  lines: [emptyPurchaseLine()],
  reference: "",
});
export const productOptionValue = (product: Pick<Product, "sku" | "name" | "productType">) =>
  `${product.sku} • ${product.name} • ${product.productType}`;
export const isPurchasableProduct = (product: Pick<Product, "trackInventory" | "productType">) =>
  product.trackInventory || product.productType === "SERVICE";
export function getBusinessDateKey(value: string | Date, timeZone: string) {
  const instant = value instanceof Date ? value : new Date(value);
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

const shiftBusinessDate = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export function getBusinessDateRange(
  period: Period,
  from: string,
  to: string,
  timeZone: string,
  now = new Date(),
) {
  if (!period) return null;
  if (period === "custom") return { from: from || undefined, to: to || undefined };
  const today = getBusinessDateKey(now, timeZone);
  const start = period === "today"
    ? today
    : period === "week"
      ? shiftBusinessDate(today, -6)
      : `${today.slice(0, 7)}-01`;
  return { from: start, to: today };
}

export function matchesPeriod(
  value: string,
  period: Period,
  from: string,
  to: string,
  timeZone = "UTC",
): boolean {
  const businessDate = getBusinessDateKey(value, timeZone);
  if (period === "custom")
    return (!from || businessDate >= from) && (!to || businessDate <= to);
  if (!period) return true;
  return businessDate >= (getBusinessDateRange(period, from, to, timeZone)?.from ?? businessDate);
}

export function formatDateTimeInTimeZone(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function matchesProductSearch(
  product: Pick<Product, "sku" | "name" | "productType">,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = `${product.sku} ${product.name} ${product.productType}`.toLowerCase();
  return haystack.includes(normalized);
}

export function summarizeSalesTotals(items: SalesHistory[]) {
  const orderCount = items.length;
  const qty = items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0,
  );
  const amounts = items.flatMap((item) => item.lines).map(calculateSalesLineAmounts);
  const grossSales = amounts.reduce((sum, amount) => sum + amount.grossAmount, 0);
  const tax = amounts.reduce((sum, amount) => sum + amount.gstAmount, 0);

  return {
    orderCount,
    qty,
    grossSales,
    tax,
    netSales: grossSales - tax,
  };
}

export function summarizePurchaseTotals(items: Purchase[]) {
  const receiptCount = items.length;
  const qty = items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0,
  );
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return {
    receiptCount,
    qty,
    total,
    average: receiptCount ? total / receiptCount : 0,
  };
}

export function calculateSalesLineAmounts(line: SalesHistory["lines"][number]) {
  const grossAmount = line.unitPrice * line.quantity;
  const cgstAmount = grossAmount * (line.cgstRate / 100);
  const sgstAmount = grossAmount * (line.sgstRate / 100);
  const gstAmount = cgstAmount + sgstAmount;
  const netAmount = grossAmount - gstAmount;
  return { grossAmount, cgstAmount, sgstAmount, gstAmount, netAmount };
}

export function groupByKey<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

type SalesGrouping = "name" | "category" | "hsn" | "invoice" | "paymentType";
type SalesLineEntry = { item: SalesHistory; line: SalesHistory["lines"][number] };

export function getSalesGroupKey(entry: SalesLineEntry, groupBy: SalesGrouping) {
  if (groupBy === "name") return entry.line.productName;
  if (groupBy === "category") return entry.line.categoryName || "Uncategorized";
  if (groupBy === "hsn") return entry.line.hsnCode || "No HSN";
  if (groupBy === "invoice") return entry.item.orderNumber;
  return entry.item.paymentMethod?.toUpperCase() || "UNKNOWN";
}

export function sumSalesGroupQuantity(entries: SalesLineEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.line.quantity, 0);
}

export function OperationsView({
  bootstrap,
  locationId,
  role,
  onNotice,
  onInventoryChanged,
  onKdsEnabledChanged,
  onTimeZoneChanged,
  initialTab = "inventory",
}: {
  bootstrap: PosBootstrap;
  locationId: string;
  role: string;
  onNotice: (message: string) => void;
  onInventoryChanged: () => Promise<void>;
  onKdsEnabledChanged: (enabled: boolean) => void;
  onTimeZoneChanged: (timeZone: string) => void;
  initialTab?: "inventory" | "vendors" | "purchases" | "sales" | "settings";
}) {
  const [tab, setTab] = useState<
    "inventory" | "vendors" | "purchases" | "sales" | "settings"
  >(initialTab);
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<SalesHistory[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [savingKdsSetting, setSavingKdsSetting] = useState(false);
  const [savingTimeZone, setSavingTimeZone] = useState(false);
  const [supplierForm, setSupplierForm] =
    useState<SupplierForm>(emptySupplierForm());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(
    null,
  );
  const [purchaseForm, setPurchaseForm] =
    useState<PurchaseForm>(emptyPurchaseForm());
  const [productPickerLine, setProductPickerLine] = useState<number | null>(null);
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(
    null,
  );
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<
    "none" | SalesGrouping
  >("none");
  const [collapsedSalesGroups, setCollapsedSalesGroups] = useState<Record<string, boolean>>({});
  const purchasableProducts = bootstrap.products.filter(isPurchasableProduct);
  const pickerProducts = purchasableProducts.filter((product) =>
    matchesProductSearch(product, productPickerSearch),
  );
  const admin = role !== "Cashier" && role !== "CounterStaff";
  const canEditPurchase = role !== "Cashier" && role !== "CounterStaff";
  const canManageSettings = ["OrganizationOwner", "OperationsManager", "StoreManager"].includes(role);
  const timeZone = bootstrap.businessLocation.timeZone;

  const saveKdsSetting = async (enabled: boolean) => {
    setSavingKdsSetting(true);
    try {
      await updateKdsSettings(enabled);
      onKdsEnabledChanged(enabled);
      onNotice(`KDS ${enabled ? "enabled" : "disabled"}`);
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "KDS setting could not be saved");
    } finally {
      setSavingKdsSetting(false);
    }
  };
  const saveTimeZone = async (nextTimeZone: string) => {
    setSavingTimeZone(true);
    try {
      const result = await updateOrganizationTimeZone(nextTimeZone);
      onTimeZoneChanged(result.timeZone);
      onNotice("Business timezone updated");
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "Business timezone could not be saved");
    } finally {
      setSavingTimeZone(false);
    }
  };

  const refresh = async () => {
    if (tab === "inventory") {
      setInventory(await fetchInventory());
      setMovements(await fetchStockMovements());
    }
    if (tab === "vendors") setSuppliers(await fetchSuppliers());
    if (tab === "purchases") {
      setSuppliers(await fetchSuppliers());
      setPurchases(await fetchPurchases());
    }
  };
  useEffect(() => {
    if (tab !== "sales") void refresh();
  }, [tab]);
  useEffect(() => {
    if (tab !== "sales" && groupBy === "paymentType") setGroupBy("none");
  }, [tab, groupBy]);
  const loadSales = async () => {
    const range = getBusinessDateRange(period, from, to, timeZone);
    const [history, totals] = await Promise.all([
      fetchSalesHistory(range?.from, range?.to),
      range?.from && range?.to
        ? fetchSalesSummary(range.from, range.to)
        : Promise.resolve(null),
    ]);
    setSales(history);
    setSummary(totals);
  };
  useEffect(() => {
    if (tab === "sales") void loadSales();
  }, [tab, period, from, to, timeZone]);

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingSupplierId) {
        await updateSupplier(editingSupplierId, {
          ...supplierForm,
          email: supplierForm.email || undefined,
          phone: supplierForm.phone || undefined,
          active: true,
        });
        onNotice("Vendor updated");
      } else {
        await createSupplier({
          ...supplierForm,
          email: supplierForm.email || undefined,
          phone: supplierForm.phone || undefined,
        });
        onNotice("Vendor added");
      }
      setSupplierForm(emptySupplierForm());
      setEditingSupplierId(null);
      await refresh();
    } catch (caught) {
      onNotice(
        caught instanceof Error ? caught.message : "Vendor could not be saved",
      );
    }
  };
  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (purchaseForm.lines.some((line) => !line.productId)) {
        onNotice("Choose an inventory product for each purchase line from the search results.");
        return;
      }
      if (!canEditPurchase && editingPurchaseId) {
        onNotice(
          "Cashiers can receive purchases, but cannot edit existing receipts.",
        );
        return;
      }
      const input = {
        supplierId: purchaseForm.supplierId,
        locationId,
        reference: purchaseForm.reference || `PO-${Date.now()}`,
        lines: purchaseForm.lines.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
        })),
      };
      if (editingPurchaseId) {
        await updatePurchase(editingPurchaseId, input);
        onNotice("Purchase updated");
      } else {
        await receivePurchase(input);
        onNotice("Purchase recorded");
      }
      setPurchaseForm(emptyPurchaseForm());
      setEditingPurchaseId(null);
      await onInventoryChanged();
      await refresh();
    } catch (caught) {
      onNotice(
        caught instanceof Error
          ? caught.message
          : "Purchase could not be saved",
      );
    }
  };
  const editSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setSupplierForm({
      code: supplier.code,
      name: supplier.name,
      email: supplier.email || "",
      phone: supplier.phone || "",
    });
  };
  const editPurchase = (purchase: Purchase) => {
    if (!canEditPurchase) {
      onNotice(
        "Cashiers can receive purchases, but cannot edit existing receipts.",
      );
      return;
    }
    if (!purchase.lines.length) return;
    setEditingPurchaseId(purchase.id);
    setPurchaseForm({
      supplierId: purchase.supplierId,
      lines: purchase.lines.map((line) => {
        const product = purchasableProducts.find((item) => item.id === line.productId);
        return {
          productId: line.productId,
          productSearch: product ? productOptionValue(product) : "",
          quantity: String(line.quantity),
          unitCost: String(line.unitCost),
        };
      }),
      reference: purchase.reference,
    });
  };
  const filterText = search.toLowerCase();
  const filteredSuppliers = suppliers.filter((item) =>
    `${item.code} ${item.name} ${item.email || ""} ${item.phone || ""}`
      .toLowerCase()
      .includes(filterText),
  );
  const filteredPurchases = purchases.filter(
    (item) =>
      matchesPeriod(item.createdAt, period, from, to, timeZone) &&
      `${item.reference} ${item.supplierName} ${item.lines.map((line) => `${line.productName} ${line.productId}`).join(" ")}`
        .toLowerCase()
        .includes(filterText),
  );
  const filteredSales = sales.filter(
    (item) =>
      matchesPeriod(item.createdAt, period, from, to, timeZone) &&
      `${item.orderNumber} ${item.status} ${item.paymentStatus} ${item.lines.map((line) => `${line.productName} ${line.categoryName} ${line.hsnCode || ""}`).join(" ")}`
        .toLowerCase()
        .includes(filterText),
  );
  const purchaseTotals = summarizePurchaseTotals(filteredPurchases);
  const salesTotals = summarizeSalesTotals(filteredSales);

  const productById = new Map(bootstrap.products.map((product) => [product.id, product]));
  const categoryById = new Map(bootstrap.categories.map((category) => [category.id, category]));

  const salesEntries: SalesLineEntry[] = filteredSales.flatMap((item) =>
    item.lines.map((line) => ({ item, line })),
  );
  const salesGroups = groupBy === "none" ? null : groupByKey(salesEntries, (entry) => getSalesGroupKey(entry, groupBy));

  type PurchaseLineEntry = { item: Purchase; line: Purchase["lines"][number] };
  const purchaseEntries: PurchaseLineEntry[] = filteredPurchases.flatMap((item) =>
    item.lines.map((line) => ({ item, line })),
  );
  const purchaseGroupKey = (entry: PurchaseLineEntry) => {
    const product = productById.get(entry.line.productId);
    if (groupBy === "name") return entry.line.productName;
    if (groupBy === "category") return (product && categoryById.get(product.categoryId)?.name) || "Uncategorized";
    if (groupBy === "hsn") return product?.hsnCode || "No HSN";
    if (groupBy === "invoice") return entry.item.reference;
    return "";
  };
  const purchaseGroups = groupBy === "none" || groupBy === "paymentType" ? null : groupByKey(purchaseEntries, purchaseGroupKey);

  const filterBar = (
    <div className="filter-bar">
      <input
        placeholder="Search name, invoice or reference"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        value={period}
        onChange={(event) => setPeriod(event.target.value as Period)}
      >
        <option value="">All dates</option>
        <option value="today">Today</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="custom">Custom dates</option>
      </select>
      {period === "custom" && (
        <>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </>
      )}
      <select
        value={groupBy}
        onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
      >
        <option value="none">No grouping</option>
        <option value="name">Group by name</option>
        <option value="category">Group by category</option>
        <option value="hsn">Group by HSN</option>
        <option value="invoice">Group by invoice</option>
        {tab === "sales" && <option value="paymentType">Group by payment type (Cash/UPI)</option>}
      </select>
    </div>
  );

  return (
    <section className="operations-view">
      <div className="report-tabs">
        {admin && (
          <button
            className={tab === "inventory" ? "active" : ""}
            onClick={() => setTab("inventory")}
          >
            Inventory
          </button>
        )}
        {admin && (
          <button
            className={tab === "vendors" ? "active" : ""}
            onClick={() => setTab("vendors")}
          >
            Vendors
          </button>
        )}
        <button
          className={tab === "purchases" ? "active" : ""}
          onClick={() => setTab("purchases")}
        >
          Purchases
        </button>
        {admin && (
          <button
            className={tab === "sales" ? "active" : ""}
            onClick={() => setTab("sales")}
          >
            Sales history
          </button>
        )}
        {canManageSettings && (
          <button
            className={tab === "settings" ? "active" : ""}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        )}
      </div>
      {tab === "settings" && canManageSettings && (
        <section className="table-panel">
          <div className="panel-heading">
            <h2>Kitchen display</h2>
          </div>
          <label className="setting-toggle">
            <span>Enable KDS</span>
            <input
              type="checkbox"
              checked={bootstrap.businessLocation.kdsEnabled}
              disabled={savingKdsSetting}
              onChange={(event) => void saveKdsSetting(event.target.checked)}
            />
          </label>
          <label className="setting-toggle">
            <span>Business timezone</span>
            <select
              value={timeZone}
              disabled={savingTimeZone}
              onChange={(event) => void saveTimeZone(event.target.value)}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern (New York)</option>
              <option value="America/Chicago">Central (Chicago)</option>
              <option value="Asia/Kolkata">India (Kolkata)</option>
            </select>
          </label>
        </section>
      )}
      {tab === "inventory" && (
        <div className="admin-grid">
          <section className="table-panel">
            <div className="panel-heading">
              <h2>Inventory</h2>
              <span>{inventory.length} items</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>On hand</th>
                    <th>Available</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.sku}</td>
                      <td>{item.productName}</td>
                      <td>{item.onHand}</td>
                      <td>{item.available}</td>
                      <td>{item.lowStock ? "LOW STOCK" : "Healthy"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="table-panel">
            <div className="panel-heading">
              <h2>Stock movements</h2>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Type</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{item.movementType}</td>
                      <td>{formatDateTimeInTimeZone(item.createdAt, timeZone)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {tab === "vendors" && (
        <div className="admin-grid">
          {filterBar}
          <form className="form-panel" onSubmit={saveSupplier}>
            <h2>{editingSupplierId ? "Edit vendor" : "Add vendor"}</h2>
            <label>
              Code
              <input
                required
                value={supplierForm.code}
                onChange={(event) =>
                  setSupplierForm({ ...supplierForm, code: event.target.value })
                }
              />
            </label>
            <label>
              Name
              <input
                required
                value={supplierForm.name}
                onChange={(event) =>
                  setSupplierForm({ ...supplierForm, name: event.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={supplierForm.email}
                onChange={(event) =>
                  setSupplierForm({
                    ...supplierForm,
                    email: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Phone
              <input
                value={supplierForm.phone}
                onChange={(event) =>
                  setSupplierForm({
                    ...supplierForm,
                    phone: event.target.value,
                  })
                }
              />
            </label>
            <div className="form-actions">
              <button className="primary-button">
                {editingSupplierId ? "Save vendor" : "Add vendor"}
              </button>
            </div>
          </form>
          <section className="table-panel">
            <div className="panel-heading">
              <h2>Vendors</h2>
              <span>{filteredSuppliers.length}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{item.email || item.phone || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editSupplier(item)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {tab === "purchases" && (
        <div className="admin-grid purchase-workspace">
          <form className="form-panel" onSubmit={savePurchase}>
            <h2>{editingPurchaseId ? "Edit purchase" : "Receive purchase"}</h2>
            <label>
              Vendor
              <select
                required
                value={purchaseForm.supplierId}
                onChange={(event) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    supplierId: event.target.value,
                  })
                }
              >
                <option value="">Choose vendor</option>
                {suppliers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Invoice / reference
              <input
                required
                value={purchaseForm.reference}
                onChange={(event) =>
                  setPurchaseForm({ ...purchaseForm, reference: event.target.value })
                }
              />
            </label>
            <div className="purchase-table-wrap">
              <table className="purchase-entry-table">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Unit cost</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
            {purchaseForm.lines.map((line, index) => (
              <tr key={index}>
                <td className="purchase-product-cell">
                  <input
                    required
                    readOnly
                    placeholder="Search product or SKU"
                    value={line.productSearch}
                    onClick={() => {
                      setProductPickerLine(index);
                      setProductPickerSearch(line.productSearch);
                    }}
                  />
                </td>
                <td>
                  <input
                    required
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={line.quantity}
                    onChange={(event) =>
                      setPurchaseForm({
                        ...purchaseForm,
                        lines: purchaseForm.lines.map((currentLine, lineIndex) =>
                          lineIndex === index ? { ...currentLine, quantity: event.target.value } : currentLine,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) =>
                      setPurchaseForm({
                        ...purchaseForm,
                        lines: purchaseForm.lines.map((currentLine, lineIndex) =>
                          lineIndex === index ? { ...currentLine, unitCost: event.target.value } : currentLine,
                        ),
                      })
                    }
                  />
                </td>
                <td>
                {purchaseForm.lines.length > 1 && (
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label="Remove product"
                    title="Remove product"
                    onClick={() => {
                      setPurchaseForm({
                        ...purchaseForm,
                        lines: purchaseForm.lines.filter((_, lineIndex) => lineIndex !== index),
                      });
                    }}
                  >
                    ×
                  </button>
                )}
                </td>
              </tr>
            ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setPurchaseForm({
                  ...purchaseForm,
                  lines: [...purchaseForm.lines, emptyPurchaseLine()],
                });
              }}
            >
              Add item
            </button>
            {productPickerLine !== null && (
              <div className="purchase-picker-backdrop" role="presentation" onMouseDown={() => setProductPickerLine(null)}>
                <div className="purchase-picker" role="dialog" aria-modal="true" aria-labelledby="purchase-picker-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="purchase-picker-header">
                    <div>
                      <h3 id="purchase-picker-title">Choose purchase item</h3>
                      <p>Select a stock item or service expense for line {productPickerLine + 1}.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => setProductPickerLine(null)}>Close</button>
                  </div>
                  <input
                    autoFocus
                    placeholder="Search by SKU, name or type"
                    value={productPickerSearch}
                    onChange={(event) => setProductPickerSearch(event.target.value)}
                  />
                  <div className="purchase-picker-grid">
                    {pickerProducts.map((product) => (
                      <button
                        type="button"
                        className="purchase-picker-product"
                        key={product.id}
                        onClick={() => {
                          setPurchaseForm({
                            ...purchaseForm,
                            lines: purchaseForm.lines.map((line, lineIndex) =>
                              lineIndex === productPickerLine
                                ? { ...line, productId: product.id, productSearch: productOptionValue(product) }
                                : line,
                            ),
                          });
                          setProductPickerLine(null);
                          setProductPickerSearch("");
                        }}
                      >
                        <strong>{product.name}</strong>
                        <span>{product.sku}</span>
                        <small>{product.productType}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <button
              className="primary-button"
              disabled={Boolean(editingPurchaseId && !canEditPurchase)}
            >
              {editingPurchaseId ? "Save purchase" : "Receive purchase"}
            </button>
          </form>
          <section className="table-panel">
            <div className="panel-heading">
              <h2>Purchases</h2>
              <span>{filteredPurchases.length}</span>
            </div>
            <div className="summary-grid">
              <strong>
                {purchaseTotals.receiptCount}
                <small>Receipts</small>
              </strong>
              <strong>
                {purchaseTotals.qty}
                <small>Qty</small>
              </strong>
              <strong>
                {purchaseTotals.total.toFixed(2)}
                <small>Total</small>
              </strong>
            </div>
            {filterBar}
            <div className="table-scroll">
              <table>
                {purchaseGroups === null ? (
                  <>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Vendor</th>
                        <th>Total</th>
                        <th>Received</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.map((item) => (
                        <tr key={item.id}>
                          <td>{item.reference}</td>
                          <td>{item.supplierName}</td>
                          <td>{item.total.toFixed(2)}</td>
                          <td>{formatDateTimeInTimeZone(item.createdAt, timeZone)}</td>
                          <td>
                            {canEditPurchase ? (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => editPurchase(item)}
                              >
                                {editingPurchaseId === item.id ? "Editing" : "Edit"}
                              </button>
                            ) : (
                              <span className="muted-text">Read-only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Vendor</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit Cost</th>
                        <th>Line Total</th>
                        <th>Received</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseGroups.map(([groupLabel, entries]) => {
                        const groupQty = entries.reduce((sum, entry) => sum + entry.line.quantity, 0);
                        const groupTotal = entries.reduce(
                          (sum, entry) => sum + entry.line.quantity * entry.line.unitCost,
                          0,
                        );
                        return (
                          <>
                            <tr key={`group-${groupLabel}`} className="group-row">
                              <td colSpan={5}>
                                {groupLabel} ({entries.length})
                              </td>
                              <td>{groupQty}</td>
                              <td>{groupTotal.toFixed(2)}</td>
                              <td />
                            </tr>
                            {entries.map((entry, entryIndex) => (
                              <tr key={`${groupLabel}-${entry.item.id}-${entry.line.productId}-${entryIndex}`}>
                                <td>{entry.item.reference}</td>
                                <td>{entry.item.supplierName}</td>
                                <td>{entry.line.productName}</td>
                                <td>{entry.line.quantity}</td>
                                <td>{entry.line.unitCost.toFixed(2)}</td>
                                <td>{(entry.line.quantity * entry.line.unitCost).toFixed(2)}</td>
                                <td>{formatDateTimeInTimeZone(entry.item.createdAt, timeZone)}</td>
                                <td>
                                  {canEditPurchase ? (
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => editPurchase(entry.item)}
                                    >
                                      {editingPurchaseId === entry.item.id ? "Editing" : "Edit"}
                                    </button>
                                  ) : (
                                    <span className="muted-text">Read-only</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </>
                        );
                      })}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </section>
        </div>
      )}
      {tab === "sales" && (
        <div className="sales-full-width">
          <section className="table-panel sales-panel-full">
            <div className="panel-heading">
              <h2>Sales summary</h2>
            </div>
            <div className="summary-grid">
              <strong>
                {salesTotals.orderCount}
                <small>Orders</small>
              </strong>
              <strong>
                {salesTotals.qty}
                <small>Qty</small>
              </strong>
              <strong>
                {salesTotals.grossSales.toFixed(2)}
                <small>Gross sales</small>
              </strong>
              <strong>
                {salesTotals.tax.toFixed(2)}
                <small>GST</small>
              </strong>
              <strong>
                {salesTotals.netSales.toFixed(2)}
                <small>Net</small>
              </strong>
            </div>
          </section>
          <div className="sales-filters-row">{filterBar}</div>
          <section className="table-panel sales-panel-full">
            <div className="panel-heading">
              <h2>Sales history</h2>
              <span>{filteredSales.length}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>HSN</th>
                    <th>Category</th>
                    <th>Item</th>
                    <th>Sale Date Time</th>
                    <th>Qty</th>
                    <th>Total Amount (Gross)</th>
                    <th>GST % and Amount</th>
                    <th>CGST % and Amt</th>
                    <th>SGST % and Amount</th>
                    <th>Total without Tax (Net)</th>
                  </tr>
                </thead>
                <tbody>
                  {salesGroups === null
                    ? filteredSales.flatMap((item) =>
                        item.lines.map((line, lineIndex) => (
                          <SalesLineRow
                            key={`${item.orderId}-${line.productId}-${lineIndex}`}
                            item={item}
                            line={line}
                            timeZone={timeZone}
                          />
                        )),
                      )
                    : salesGroups.map(([groupLabel, entries]) => {
                        const groupTotals = summarizeSalesTotals(
                          entries.map((entry) => ({ ...entry.item, lines: [entry.line] })),
                        );
                        const groupKey = `${groupBy}:${groupLabel}`;
                        const collapsed = collapsedSalesGroups[groupKey] ?? false;
                        return (
                          <Fragment key={groupKey}>
                            <tr className="group-row">
                              <td colSpan={5}>
                                <button
                                  type="button"
                                  className="group-toggle"
                                  aria-expanded={!collapsed}
                                  aria-label={`${collapsed ? "Show" : "Hide"} items in ${groupLabel}`}
                                  onClick={() => setCollapsedSalesGroups((current) => ({
                                    ...current,
                                    [groupKey]: !collapsed,
                                  }))}
                                >
                                  {collapsed ? "Show items" : "Hide items"}
                                </button>
                                {groupLabel} ({entries.length} lines)
                              </td>
                              <td>{sumSalesGroupQuantity(entries)}</td>
                              <td>{groupTotals.grossSales.toFixed(2)}</td>
                              <td>{groupTotals.tax.toFixed(2)}</td>
                              <td />
                              <td />
                              <td>{groupTotals.netSales.toFixed(2)}</td>
                            </tr>
                            {!collapsed && entries.map((entry, entryIndex) => (
                              <SalesLineRow
                                key={`${groupLabel}-${entry.item.orderId}-${entry.line.productId}-${entryIndex}`}
                                item={entry.item}
                                line={entry.line}
                                timeZone={timeZone}
                              />
                            ))}
                          </Fragment>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function SalesLineRow({
  item,
  line,
  timeZone,
}: {
  item: SalesHistory;
  line: SalesHistory["lines"][number];
  timeZone: string;
}) {
  const { grossAmount, cgstAmount, sgstAmount, gstAmount, netAmount } =
    calculateSalesLineAmounts(line);
  return (
    <tr>
      <td>{item.orderNumber}</td>
      <td>{line.hsnCode || "—"}</td>
      <td>{line.categoryName || "—"}</td>
      <td>{line.productName}</td>
      <td>{formatDateTimeInTimeZone(item.createdAt, timeZone)}</td>
      <td>{line.quantity}</td>
      <td>{grossAmount.toFixed(2)}</td>
      <td>
        {line.gstRate}%<br />
        {gstAmount.toFixed(2)}
      </td>
      <td>
        {line.cgstRate}%<br />
        {cgstAmount.toFixed(2)}
      </td>
      <td>
        {line.sgstRate}%<br />
        {sgstAmount.toFixed(2)}
      </td>
      <td>{netAmount.toFixed(2)}</td>
    </tr>
  );
}

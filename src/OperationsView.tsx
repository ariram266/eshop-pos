import { useEffect, useState } from "react";
import {
  createSupplier,
  fetchInventory,
  fetchPurchases,
  fetchSalesHistory,
  fetchSalesSummary,
  fetchStockMovements,
  fetchSuppliers,
  receivePurchase,
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
  productId: string;
  quantity: string;
  unitCost: string;
  reference: string;
};
type Period = "" | "today" | "week" | "month" | "custom";

const emptySupplierForm = (): SupplierForm => ({
  code: "",
  name: "",
  email: "",
  phone: "",
});
const emptyPurchaseForm = (): PurchaseForm => ({
  supplierId: "",
  productId: "",
  quantity: "",
  unitCost: "",
  reference: "",
});
const startOfPeriod = (period: Period) => {
  const date = new Date();
  if (period === "today") date.setHours(0, 0, 0, 0);
  if (period === "week") {
    date.setDate(date.getDate() - 6);
    date.setHours(0, 0, 0, 0);
  }
  if (period === "month") {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  }
  return date;
};
const matchesPeriod = (
  value: string,
  period: Period,
  from: string,
  to: string,
) => {
  if (period === "custom")
    return (!from || value >= from) && (!to || value <= `${to}T23:59:59`);
  if (!period) return true;
  return new Date(value) >= startOfPeriod(period);
};

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

export function OperationsView({
  bootstrap,
  locationId,
  role,
  onNotice,
  initialTab = "inventory",
}: {
  bootstrap: PosBootstrap;
  locationId: string;
  role: string;
  onNotice: (message: string) => void;
  initialTab?: "inventory" | "vendors" | "purchases" | "sales";
}) {
  const [tab, setTab] = useState<
    "inventory" | "vendors" | "purchases" | "sales"
  >(initialTab);
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<SalesHistory[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [supplierForm, setSupplierForm] =
    useState<SupplierForm>(emptySupplierForm());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(
    null,
  );
  const [purchaseForm, setPurchaseForm] =
    useState<PurchaseForm>(emptyPurchaseForm());
  const [productSearch, setProductSearch] = useState("");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(
    null,
  );
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<
    "none" | "name" | "category" | "hsn" | "invoice"
  >("none");
  const receivableProducts = bootstrap.products.filter(
    (product) => product.trackInventory,
  );
  const admin = role !== "Cashier" && role !== "CounterStaff";
  const canEditPurchase = role !== "Cashier" && role !== "CounterStaff";

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
    if (tab === "sales") {
      setSales(await fetchSalesHistory());
      setSummary(await fetchSalesSummary());
    }
  };
  useEffect(() => {
    void refresh();
  }, [tab]);

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
      if (!purchaseForm.productId) {
        onNotice("Choose an inventory product from the search results.");
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
        lines: [
          {
            productId: purchaseForm.productId,
            quantity: Number(purchaseForm.quantity),
            unitCost: Number(purchaseForm.unitCost),
          },
        ],
      };
      if (editingPurchaseId) {
        await updatePurchase(editingPurchaseId, input);
        onNotice("Purchase updated and inventory reconciled");
      } else {
        await receivePurchase(input);
        onNotice("Purchase received and inventory updated");
      }
      setPurchaseForm(emptyPurchaseForm());
      setProductSearch("");
      setEditingPurchaseId(null);
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
    const line = purchase.lines[0];
    if (!line) return;
    const product = receivableProducts.find(
      (item) => item.id === line.productId,
    );
    setEditingPurchaseId(purchase.id);
    setProductSearch(product ? `${product.name} (${product.productType})` : "");
    setPurchaseForm({
      supplierId: purchase.supplierId,
      productId: line.productId,
      quantity: String(line.quantity),
      unitCost: String(line.unitCost),
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
      matchesPeriod(item.createdAt, period, from, to) &&
      `${item.reference} ${item.supplierName} ${item.lines.map((line) => `${line.productName} ${line.productId}`).join(" ")}`
        .toLowerCase()
        .includes(filterText),
  );
  const filteredSales = sales.filter(
    (item) =>
      matchesPeriod(item.createdAt, period, from, to) &&
      `${item.orderNumber} ${item.status} ${item.paymentStatus} ${item.lines.map((line) => `${line.productName} ${line.categoryName} ${line.hsnCode || ""}`).join(" ")}`
        .toLowerCase()
        .includes(filterText),
  );
  const purchaseTotals = summarizePurchaseTotals(filteredPurchases);
  const salesTotals = summarizeSalesTotals(filteredSales);
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
      </div>
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
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
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
        <div className="admin-grid">
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
              Inventory product
              <input
                required
                list="receivable-products"
                placeholder="Search by SKU or item name"
                value={productSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  const product = receivableProducts.find((item) =>
                    matchesProductSearch(item, value),
                  );
                  setProductSearch(value);
                  setPurchaseForm({
                    ...purchaseForm,
                    productId: product?.id || "",
                  });
                }}
              />
              <datalist id="receivable-products">
                {receivableProducts.map((item) => (
                  <option
                    key={item.id}
                    value={`${item.sku} • ${item.name} • ${item.productType}`}
                  />
                ))}
              </datalist>
            </label>
            <label>
              Quantity
              <input
                required
                type="number"
                min="0.0001"
                step="0.0001"
                value={purchaseForm.quantity}
                onChange={(event) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    quantity: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Unit cost
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={purchaseForm.unitCost}
                onChange={(event) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    unitCost: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Invoice / reference
              <input
                required
                value={purchaseForm.reference}
                onChange={(event) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    reference: event.target.value,
                  })
                }
              />
            </label>
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
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
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
                  {filteredSales.flatMap((item) =>
                    item.lines.map((line, lineIndex) => {
                      const {
                        grossAmount,
                        cgstAmount,
                        sgstAmount,
                        gstAmount,
                        netAmount,
                      } = calculateSalesLineAmounts(line);

                      return (
                        <tr key={`${item.orderId}-${line.productId}-${lineIndex}`}>
                          <td>{item.orderNumber}</td>
                          <td>{line.hsnCode || "—"}</td>
                          <td>{line.categoryName || "—"}</td>
                          <td>{line.productName}</td>
                          <td>{new Date(item.createdAt).toLocaleString()}</td>
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
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

const cloudApi = import.meta.env.VITE_CLOUD_API_URL || ''
import { accessToken, getPreferredLocalDevRole, isLocalDevelopment, signOut, startEntraLogin } from './auth'

export type Actor = { organizationId: string; userId: string; locationId: string; role: string; displayName: string }
export type BusinessLocation = { businessName: string; locationName: string; gstNumber?: string }
export type Product = { id: string; sku: string; name: string; categoryId: string; price: number; unit: string; availableQuantity: number; productType: string; preparationStationId?: string; taxRate: number; active: boolean; hsnCode?: string; gstRate: number; cgstRate: number; sgstRate: number; trackInventory: boolean }
export type Category = { id: string; name: string; parentId?: string; active: boolean }
export type TaxRule = { id: string; name: string; rate: number }
export type PreparationStation = { id: string; name: string; code: string }
export type ModifierGroup = { id: string; name: string; required: boolean }
export type Modifier = { id: string; modifierGroupId: string; name: string; priceDelta: number }
export type PosBootstrap = { categories: Category[]; products: Product[]; modifierGroups: ModifierGroup[]; modifiers: Modifier[]; taxRules: TaxRule[]; preparationStations: PreparationStation[]; locationId: string; currency: string; businessLocation: BusinessLocation }
export type OrderLine = { productId: string; name: string; unitPrice: number; quantity: number; taxAmount: number; preparationStationCode?: string; gstRate?: number; cgstRate?: number; sgstRate?: number }
export type Order = { id: string; orderNumber: string; status: string; subtotal: number; tax: number; total: number; paymentStatus: string; lines: OrderLine[]; createdAt: string }
export type KdsWorkItem = { id: string; orderId: string; orderNumber: string; productName: string; quantity: number; stationCode: string; status: string; createdAt: string }
export type CatalogProduct = { id: string; sku: string; name: string; categoryId: string; price: number; unit: string; productType: string; active: boolean }
export type Supplier = { id: string; code: string; name: string; email?: string; phone?: string; active: boolean }
export type PurchaseLine = { productId: string; productName: string; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string }
export type Purchase = { id: string; reference: string; supplierId: string; supplierName: string; locationId: string; total: number; status: string; createdAt: string; lines: PurchaseLine[] }
export type InventorySummary = { productId: string; sku: string; productName: string; onHand: number; reserved: number; available: number; reorderLevel: number; lowStock: boolean }
export type StockMovement = { id: string; productId: string; productName: string; quantity: number; movementType: string; source?: string; createdAt: string }
export type SalesHistoryLine = { productId: string; productName: string; categoryName: string; hsnCode?: string; gstRate: number; cgstRate: number; sgstRate: number; quantity: number; unitPrice: number; taxAmount: number }
export type SalesHistory = { orderId: string; orderNumber: string; total: number; status: string; paymentStatus: string; createdAt: string; lines: SalesHistoryLine[] }
export type SalesSummary = { orderCount: number; grossSales: number; tax: number; netSales: number; from: string; to: string }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await accessToken()
  const localRoleValue = isLocalDevelopment ? getPreferredLocalDevRole() : ''
  const localRoleHeader: Record<string, string> = localRoleValue ? { 'X-Local-Dev-Role': localRoleValue } : {}
  const response = await fetch(`${cloudApi}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...localRoleHeader, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  if (response.status === 401) throw new Error('Authentication required')
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export const fetchActor = () => request<Actor>('/api/auth/me')
export const fetchPosBootstrap = () => request<PosBootstrap>('/api/pos/bootstrap')
export const fetchActiveKds = () => request<KdsWorkItem[]>('/api/kds/orders/active')
export const updateKdsStatus = (id: string, status: string) => request<KdsWorkItem>(`/api/kds/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
export const createCategory = (name: string, parentId?: string) => request<Category>('/api/categories', { method: 'POST', body: JSON.stringify({ name, parentId: parentId || null }) })
export const updateCategory = (id: string, input: { name: string; parentId?: string; active: boolean }) => request<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, parentId: input.parentId || null }) })
export const createProduct = (input: { sku: string; name: string; categoryId: string; price: number; unit: string; productType: string; hsnCode?: string; gstRate: number; trackInventory: boolean }) => request<CatalogProduct>('/api/products', { method: 'POST', body: JSON.stringify(input) })
export const updateProduct = (id: string, input: { sku: string; name: string; categoryId: string; price: number; unit: string; productType: string; hsnCode?: string; gstRate: number; active: boolean; trackInventory: boolean }) => request<CatalogProduct>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
export const fetchSuppliers = () => request<Supplier[]>('/api/suppliers')
export const createSupplier = (input: { code: string; name: string; email?: string; phone?: string }) => request<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(input) })
export const updateSupplier = (id: string, input: { code: string; name: string; email?: string; phone?: string; active: boolean }) => request<Supplier>(`/api/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
export const fetchPurchases = () => request<Purchase[]>('/api/purchases')
export const receivePurchase = (input: { supplierId: string; locationId: string; reference: string; lines: Array<{ productId: string; quantity: number; unitCost: number }> }) => request<string>('/api/purchases/receive', { method: 'POST', body: JSON.stringify(input) })
export const updatePurchase = (id: string, input: { supplierId: string; locationId: string; reference: string; lines: Array<{ productId: string; quantity: number; unitCost: number }> }) => request<void>(`/api/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
export const fetchInventory = () => request<InventorySummary[]>('/api/inventory')
export const fetchStockMovements = () => request<StockMovement[]>('/api/stock-movements')
export const fetchSalesHistory = () => request<SalesHistory[]>('/api/sales')
export const fetchSalesSummary = () => request<SalesSummary>('/api/reports/sales')
export const createOrder = (input: { registerId: string; orderType: string; paymentMethod: string; lines: Array<{ productId: string; quantity: number }> }) => request<Order>('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) })

export { signOut, startEntraLogin }

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }
    return entities[character]
  })

export function buildReceiptHtml(order: Order, businessLocation?: BusinessLocation) {
  const business = businessLocation ?? { businessName: 'Counterpoint', locationName: 'Head Office', gstNumber: undefined }
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const lineAmounts = order.lines.map((line) => {
    const gross = line.unitPrice * line.quantity
    const hasRates = (line.cgstRate ?? 0) > 0 || (line.sgstRate ?? 0) > 0
    const cgst = hasRates ? roundMoney((gross * (line.cgstRate ?? 0)) / 100) : roundMoney(line.taxAmount / 2)
    const sgst = hasRates ? roundMoney((gross * (line.sgstRate ?? 0)) / 100) : roundMoney(line.taxAmount / 2)
    const gst = roundMoney(cgst + sgst)
    const gstRate = hasRates ? (line.gstRate ?? (line.cgstRate ?? 0) + (line.sgstRate ?? 0)) : gross ? (line.taxAmount / gross) * 100 : 0
    return { line, gross, cgst, sgst, gst, gstRate, net: roundMoney(gross - gst) }
  })
  const cgst = lineAmounts.reduce((sum, amount) => sum + amount.cgst, 0)
  const sgst = lineAmounts.reduce((sum, amount) => sum + amount.sgst, 0)
  const net = roundMoney(lineAmounts.reduce((sum, amount) => sum + amount.net, 0))
  const gross = roundMoney(lineAmounts.reduce((sum, amount) => sum + amount.gross, 0))
  const itemCount = order.lines.length
  const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0)
  const date = new Date(order.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const lines = lineAmounts
    .map(
      ({ line, gross: lineGross, gst: lineGst }) => `<div class="item-row">
        <span class="item-name">${escapeHtml(line.name)}</span>
        <span>${line.unitPrice.toFixed(2)}</span>
        <span>${line.quantity}</span>
        <span>${lineGst.toFixed(2)}</span>
        <span>${lineGross.toFixed(2)}</span>
      </div>`,
    )
    .join('')

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(order.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; padding: 5mm 0; color: #111; font: 12px/1.35 Arial, sans-serif; }
  .center { text-align: center; }
  .office { font-size: 16px; font-weight: 700; }
  .title { margin: 8px 0 14px; font-size: 17px; font-weight: 700; text-decoration: underline; }
  .meta { margin-bottom: 10px; }
  .meta div { margin: 2px 0; }
  .rule { border-top: 1px dashed #111; margin: 8px 0; }
  .columns, .item-row { display: grid; grid-template-columns: 1.5fr .8fr .55fr .8fr .9fr; gap: 4px; text-align: right; align-items: start; }
  .columns { font-weight: 700; }
  .columns span:first-child, .item-row span:first-child { text-align: left; }
  .item-row { padding: 8px 0; }
  .item-name { margin-bottom: 2px; max-width: 100%; overflow-wrap: anywhere; }
  .totals { margin-top: 10px; }
  .total-row { display: flex; justify-content: space-between; margin: 4px 0; }
  .grand-total { margin-top: 10px; font-size: 17px; font-weight: 700; }
  .footer { margin-top: 20px; text-align: center; font-weight: 700; }
  @media print { body { padding: 4mm 0; } }
</style></head><body>
  <div class="center office">${escapeHtml(business.businessName)}</div>
  <div class="center">${escapeHtml(business.locationName)}</div>
  <div class="center">GST# ${escapeHtml(business.gstNumber || '—')}</div>
  <div class="center title">Retail Invoice</div>
  <div class="meta"><div><strong>Customer:</strong></div><div>Walk-in Customer</div><div>Invoice# ${escapeHtml(order.orderNumber)}</div><div>Date&nbsp;&nbsp;&nbsp;&nbsp;${date}</div></div>
  <div class="rule"></div>
  <div class="columns"><span>Item</span><span>Rate</span><span>Qty</span><span>Tax</span><span>Amount</span></div>
  <div class="rule"></div>
  ${lines}
  <div class="rule"></div>
  <div class="totals">
    <div class="total-row"><span>Sub Total (Net)</span><span>₹${net.toFixed(2)}</span></div>
    <div class="total-row"><span>CGST</span><span>₹${cgst.toFixed(2)}</span></div>
    <div class="total-row"><span>SGST</span><span>₹${sgst.toFixed(2)}</span></div>
    <div class="rule"></div>
    <div class="total-row grand-total"><span>TOTAL (Gross)</span><span>₹${gross.toFixed(2)}</span></div>
  </div>
  <div class="rule"></div>
  <div>No of Items: ${itemCount}, Total Quantity: ${totalQuantity}</div>
  <div class="footer">Thank you for your visit!</div>
</body></html>`
}

export function printReceipt(order: Order, businessLocation?: BusinessLocation) {
  const printWindow = window.open('', '_blank', 'width=420,height=640')
  if (!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(buildReceiptHtml(order, businessLocation))
  printWindow.document.close()
  printWindow.print()
  printWindow.close()
  return true
}

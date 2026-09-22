const cloudApi = import.meta.env.VITE_CLOUD_API_URL || ''
import { accessToken, signOut, startEntraLogin } from './auth'

export type Actor = { organizationId: string; userId: string; locationId: string; role: string; displayName: string }
export type Product = { id: string; sku: string; name: string; categoryId: string; price: number; unit: string; availableQuantity: number; productType: string; preparationStationId?: string; taxRate: number; active: boolean; hsnCode?: string; gstRate: number; cgstRate: number; sgstRate: number; trackInventory: boolean }
export type Category = { id: string; name: string; parentId?: string; active: boolean }
export type TaxRule = { id: string; name: string; rate: number }
export type PreparationStation = { id: string; name: string; code: string }
export type ModifierGroup = { id: string; name: string; required: boolean }
export type Modifier = { id: string; modifierGroupId: string; name: string; priceDelta: number }
export type PosBootstrap = { categories: Category[]; products: Product[]; modifierGroups: ModifierGroup[]; modifiers: Modifier[]; taxRules: TaxRule[]; preparationStations: PreparationStation[]; locationId: string; currency: string }
export type OrderLine = { productId: string; name: string; unitPrice: number; quantity: number; taxAmount: number; preparationStationCode?: string }
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
  const response = await fetch(`${cloudApi}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
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

export function printReceipt(order: Order) {
  const content = [`COUNTERPOINT`, `Order ${order.orderNumber}`, '', ...order.lines.map(line => `${line.quantity} x ${line.name}  ${(line.unitPrice * line.quantity).toFixed(2)}`), '', `TOTAL ${order.total.toFixed(2)}`].join('\n')
  const printWindow = window.open('', '_blank', 'width=420,height=640')
  if (!printWindow) return false
  printWindow.document.body.innerHTML = `<pre>${content}</pre>`
  printWindow.print()
  printWindow.close()
  return true
}

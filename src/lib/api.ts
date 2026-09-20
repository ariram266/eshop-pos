const cloudApi = import.meta.env.VITE_CLOUD_API_URL ?? 'http://localhost:5080'
const agentApi = import.meta.env.VITE_AGENT_API_URL ?? 'http://127.0.0.1:9100'

export type User = { id: number; username: string; displayName: string; role: 'admin' | 'manager' | 'cashier'; locationId: number }
export type Product = { id: number; sku: string; name: string; categoryId: number; category: string; price: number; unit: string; stock: number; active: boolean; inventoryMode: 'stocked' | 'prepared'; barcode?: string; description?: string; purchasePrice: number; vendorId?: number; origin?: string; taxRate: number; hsnCode?: string; gstRate: number; cgstRate: number; sgstRate: number }
export type Category = { id: number; name: string }
export type InventoryItem = { productId: number; sku: string; productName: string; locationId: number; locationName: string; onHand: number; reorderLevel: number; unit: string; needsReorder: boolean }
export type OrderLine = { productId: number; name: string; unitPrice: number; quantity: number }
export type Order = { id: string; orderNumber: string; registerId: string; orderType: string; paymentMethod: string; status: string; subtotal: number; tax: number; total: number; createdAt: string; lines: OrderLine[] }
export type Recipe = { id: number; name: string; outputProductId: number; ingredients: Array<{ productId: number; quantityPerUnit: number; unit: string }> }
export type Organization = { name: string; currency: string; timeZone: string }
export type Location = { id: number; name: string; type: string; active: boolean }
export type Register = { id: number; registerId: string; name: string; locationId: number; deviceId: string; active: boolean }
export type UserSummary = { id: number; username: string; displayName: string; role: string; locationId: number; active: boolean }
export type Vendor = { id: number; name: string; displayName: string; email?: string; phone?: string; gstin?: string; address?: string; paymentTerms?: string; active: boolean }
export type PurchaseLineInput = { productId: number; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string }
export type PurchaseInput = { vendorId: number; locationId: number; reference: string; lines: PurchaseLineInput[] }
export type PurchaseReceipt = { id: number; vendorId: number; locationId: number; reference: string; lineCount: number }
export type PurchaseLineRecord = { productId: number; productName: string; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string }
export type PurchaseRecord = { id: number; vendorId: number; vendorName: string; locationId: number; locationName: string; reference: string; receivedBy: string; receivedAt: string; totalCost: number; lines: PurchaseLineRecord[] }
export type StockMovementRecord = { id: number; sku: string; productName: string; locationName: string; quantity: number; type: string; reason?: string; actor: string; createdAt: string }
export type LocalOrderLine = { productId: number; name: string; quantity: number; unitPrice: number }
export type LocalOrder = { id: string; orderNumber: string; registerId: string; paymentMethod: string; total: number; status: string; createdAt: string; lines: LocalOrderLine[] }

let token = localStorage.getItem('counterpoint-token') ?? ''
export const setToken = (value: string) => { token = value; localStorage.setItem('counterpoint-token', value) }
export const clearToken = () => { token = ''; localStorage.removeItem('counterpoint-token') }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${cloudApi}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
  if (response.status === 401) { clearToken(); throw new Error('Session expired') }
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export async function login(username: string, password: string) { const result = await request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); setToken(result.token); return result.user }
export async function currentUser() { return request<User>('/api/auth/me') }
export async function fetchCategories() { return request<Category[]>('/api/categories') }
export async function fetchProducts() { return request<Product[]>('/api/products') }
export async function fetchVendors() { return request<Vendor[]>('/api/vendors') }
export async function createVendor(input: { name: string; displayName: string; email?: string; phone?: string; gstin?: string; address?: string; paymentTerms?: string }) { return request<Vendor>('/api/vendors', { method: 'POST', body: JSON.stringify(input) }) }
export async function receivePurchase(input: PurchaseInput) { return request<PurchaseReceipt>('/api/purchases', { method: 'POST', body: JSON.stringify(input) }) }
export async function fetchPurchases() { return request<PurchaseRecord[]>('/api/purchases') }
export async function createProduct(input: { sku: string; name: string; categoryId: number; price: number; unit: string; active: boolean; inventoryMode: string; barcode?: string; description?: string; purchasePrice?: number; vendorId?: number; origin?: string; taxRate?: number; hsnCode?: string; gstRate?: number; cgstRate?: number; sgstRate?: number }) { return request<Product>('/api/products', { method: 'POST', body: JSON.stringify(input) }) }
export async function updateProduct(id: number, input: { sku: string; name: string; categoryId: number; price: number; unit: string; active: boolean; inventoryMode: string; barcode?: string; description?: string; purchasePrice?: number; vendorId?: number; origin?: string; taxRate?: number; hsnCode?: string; gstRate?: number; cgstRate?: number; sgstRate?: number }) { return request<Product>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export async function fetchInventory() { return request<InventoryItem[]>('/api/inventory') }
export async function fetchReorderItems() { return request<InventoryItem[]>('/api/inventory/reorder') }
export async function addStockMovement(input: { productId: number; locationId: number; quantity: number; type: string; batchNumber?: string; reason?: string }) { return request('/api/inventory/movements', { method: 'POST', body: JSON.stringify(input) }) }
export async function fetchStockMovements() { return request<StockMovementRecord[]>('/api/inventory/movements') }
export async function updateReorderLevel(productId: number, locationId: number, reorderLevel: number) { return request<InventoryItem>(`/api/inventory/${productId}/reorder-level`, { method: 'PATCH', body: JSON.stringify({ locationId, reorderLevel }) }) }
export async function createOrder(input: { registerId: string; orderType: string; paymentMethod: string; lines: Array<{ productId: number; quantity: number }> }) { return request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(input) }) }
export async function fetchOrders() { return request<Order[]>('/api/orders') }
export async function fetchRecipes() { return request<Recipe[]>('/api/recipes') }
export async function fetchOrganization() { return request<Organization>('/api/organization') }
export async function fetchLocations() { return request<Location[]>('/api/locations') }
export async function createLocation(input: { name: string; type: string }) { return request<Location>('/api/locations', { method: 'POST', body: JSON.stringify(input) }) }
export async function fetchRegisters() { return request<Register[]>('/api/registers') }
export async function fetchUsers() { return request<UserSummary[]>('/api/users') }
export async function updateUserStatus(id: number, active: boolean) { return request<UserSummary>(`/api/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }) }
export async function updateProductStatus(id: number, active: boolean) { return request<Product>(`/api/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }) }
export async function updateLocationStatus(id: number, active: boolean) { return request<Location>(`/api/locations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }) }
export async function createRecipe(input: { name: string; outputProductId: number; ingredients: Array<{ productId: number; quantityPerUnit: number; unit: string }> }) { return request<Recipe>('/api/recipes', { method: 'POST', body: JSON.stringify(input) }) }
export async function produceBatch(input: { recipeId: number; locationId: number; quantityProduced: number; expiresAt?: string }) { return request('/api/production-batches', { method: 'POST', body: JSON.stringify(input) }) }
export async function sendReceipt(order: Order): Promise<boolean> { if (!navigator.onLine) return false; const response = await fetch(`${agentApi}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, storeId: order.orderNumber, registerId: order.registerId, lines: order.lines, total: order.total }) }); return response.ok }
export async function fetchLocalProducts() { const response = await fetch(`${agentApi}/local/products`); if (!response.ok) throw new Error('Local POS Agent unavailable'); return response.json() as Promise<Product[]> }
export async function createLocalOrder(order: LocalOrder) { const response = await fetch(`${agentApi}/local/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) }); if (!response.ok) throw new Error('Local transaction could not be saved'); return response.json() as Promise<LocalOrder> }
export async function syncCatalogToAgent(products: Product[]) { const response = await fetch(`${agentApi}/local/catalog`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(products) }); if (!response.ok) throw new Error('Local catalog sync failed'); return response.json() as Promise<{ accepted: number }> }
export async function fetchLocalOrders() { const response = await fetch(`${agentApi}/local/orders`); if (!response.ok) throw new Error('Local POS Agent unavailable'); return response.json() as Promise<LocalOrder[]> }
export async function syncLocalOrdersToCloud() { const localOrders = await fetchLocalOrders(); const pending = localOrders.filter((order) => order.status === 'queued'); if (!pending.length) return 0; const result = await request<{ accepted: number }>('/api/sync', { method: 'POST', body: JSON.stringify({ deviceId: 'register-03', orders: pending.map((order) => ({ registerId: order.registerId, orderType: 'counter-sale', paymentMethod: order.paymentMethod, lines: order.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })) })) }) }); await fetch(`${agentApi}/local/sync/mark`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: pending.map((order) => order.id) }) }); return result.accepted }

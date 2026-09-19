const cloudApi = import.meta.env.VITE_CLOUD_API_URL ?? 'http://localhost:5080'
const agentApi = import.meta.env.VITE_AGENT_API_URL ?? 'http://127.0.0.1:9100'

export type User = { id: number; username: string; displayName: string; role: 'admin' | 'manager' | 'cashier'; locationId: number }
export type Product = { id: number; sku: string; name: string; categoryId: number; category: string; price: number; unit: string; stock: number; active: boolean; inventoryMode: 'stocked' | 'prepared' }
export type Category = { id: number; name: string }
export type InventoryItem = { productId: number; sku: string; productName: string; locationId: number; locationName: string; onHand: number; reorderLevel: number; unit: string; needsReorder: boolean }
export type OrderLine = { productId: number; name: string; unitPrice: number; quantity: number }
export type Order = { id: string; orderNumber: string; registerId: string; orderType: string; paymentMethod: string; status: string; subtotal: number; tax: number; total: number; createdAt: string; lines: OrderLine[] }
export type Recipe = { id: number; name: string; outputProductId: number; ingredients: Array<{ productId: number; quantityPerUnit: number; unit: string }> }

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
export async function createProduct(input: { sku: string; name: string; categoryId: number; price: number; unit: string; active: boolean; inventoryMode: string }) { return request<Product>('/api/products', { method: 'POST', body: JSON.stringify(input) }) }
export async function updateProduct(id: number, input: { sku: string; name: string; categoryId: number; price: number; unit: string; active: boolean; inventoryMode: string }) { return request<Product>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export async function fetchInventory() { return request<InventoryItem[]>('/api/inventory') }
export async function fetchReorderItems() { return request<InventoryItem[]>('/api/inventory/reorder') }
export async function addStockMovement(input: { productId: number; locationId: number; quantity: number; type: string; batchNumber?: string; reason?: string }) { return request('/api/inventory/movements', { method: 'POST', body: JSON.stringify(input) }) }
export async function updateReorderLevel(productId: number, locationId: number, reorderLevel: number) { return request<InventoryItem>(`/api/inventory/${productId}/reorder-level`, { method: 'PATCH', body: JSON.stringify({ locationId, reorderLevel }) }) }
export async function createOrder(input: { registerId: string; orderType: string; paymentMethod: string; lines: Array<{ productId: number; quantity: number }> }) { return request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(input) }) }
export async function fetchOrders() { return request<Order[]>('/api/orders') }
export async function fetchRecipes() { return request<Recipe[]>('/api/recipes') }
export async function createRecipe(input: { name: string; outputProductId: number; ingredients: Array<{ productId: number; quantityPerUnit: number; unit: string }> }) { return request<Recipe>('/api/recipes', { method: 'POST', body: JSON.stringify(input) }) }
export async function produceBatch(input: { recipeId: number; locationId: number; quantityProduced: number; expiresAt?: string }) { return request('/api/production-batches', { method: 'POST', body: JSON.stringify(input) }) }
export async function sendReceipt(order: Order): Promise<boolean> { if (!navigator.onLine) return false; const response = await fetch(`${agentApi}/print`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, storeId: order.orderNumber, registerId: order.registerId, lines: order.lines, total: order.total }) }); return response.ok }

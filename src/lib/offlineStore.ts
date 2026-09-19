export type QueuedOrder = {
  id: string
  storeId: string
  registerId: string
  createdAt: string
  lines: Array<{ productId: number; name: string; unitPrice: number; quantity: number }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
}

const databaseName = 'counterpoint-pos'
const storeName = 'offline-orders'

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' })
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export async function queueOrder(order: QueuedOrder): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(order)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getQueuedOrders(): Promise<QueuedOrder[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result as QueuedOrder[])
    request.onerror = () => reject(request.error)
  })
}

export async function clearQueuedOrder(id: string): Promise<void> {
  const database = await openDatabase()
  database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id)
}
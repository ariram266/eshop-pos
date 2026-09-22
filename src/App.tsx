import { useEffect, useMemo, useState } from 'react'
import { createCategory, createOrder, createProduct, fetchActiveKds, fetchActor, fetchPosBootstrap, printReceipt, signOut, startEntraLogin, updateCategory, updateKdsStatus, updateProduct, type Actor, type Category, type KdsWorkItem, type Order, type PosBootstrap, type Product } from './lib/api'
import { initializeAuth, isLocalDevelopment } from './lib/auth'
import { CatalogView } from './CatalogView'
import { OperationsView } from './OperationsView'
import './styles.css'

type CartLine = { product: Product; quantity: number }
const money = (value: number) => value.toFixed(2)
const registerCode = import.meta.env.VITE_REGISTER_CODE || 'register-01'

export default function App() {
  const [actor, setActor] = useState<Actor | null>(null)
  const [bootstrap, setBootstrap] = useState<PosBootstrap | null>(null)
  const [kdsItems, setKdsItems] = useState<KdsWorkItem[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [inventoryOnly, setInventoryOnly] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)
  const [mode, setMode] = useState<'pos' | 'kds' | 'catalog' | 'operations'>('pos')
  const [categoryName, setCategoryName] = useState('')
  const [categoryParentId, setCategoryParentId] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState({ sku: '', name: '', categoryId: '', price: '', unit: 'each', productType: 'MENU_ITEM', hsnCode: '', gstRate: '', trackInventory: false })
  const [editingProductId, setEditingProductId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError('')
      await initializeAuth()
      const [currentActor, catalog] = await Promise.all([fetchActor(), fetchPosBootstrap()])
      setActor(currentActor)
      setBootstrap(catalog)
      setKdsItems(await fetchActiveKds())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cloud API unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!actor) return
    const timer = window.setInterval(() => { void fetchActiveKds().then(setKdsItems).catch(() => undefined) }, 15000)
    return () => window.clearInterval(timer)
  }, [actor])

  const products = useMemo(() => (bootstrap?.products ?? []).filter(product => product.active && (!inventoryOnly || product.trackInventory) && `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [bootstrap, inventoryOnly, query])
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const tax = cart.reduce((sum, line) => sum + line.product.price * line.quantity * line.product.taxRate / 100, 0)
  const total = subtotal + tax

  const addToCart = (product: Product) => setCart(current => {
    const existing = current.find(line => line.product.id === product.id)
    if (product.trackInventory && (existing?.quantity ?? 0) >= product.availableQuantity) { setNotice(`${product.name} has insufficient stock`); return current }
    return existing ? current.map(line => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }]
  })
  const changeQuantity = (productId: string, delta: number) => setCart(current => current.map(line => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line).filter(line => line.quantity > 0))
  const completeSale = async () => {
    if (!cart.length) return
    try {
      const order = await createOrder({ registerId: registerCode, orderType: 'TAKEAWAY', paymentMethod, lines: cart.map(line => ({ productId: line.product.id, quantity: line.quantity })) })
      setLastOrder(order)
      setCart([])
      setNotice(`Order ${order.orderNumber} paid`)
      setBootstrap(await fetchPosBootstrap())
      setKdsItems(await fetchActiveKds())
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Order failed')
    }
  }
  const saveCategory = async (event: React.FormEvent) => { event.preventDefault(); try { if (editingCategoryId) { await updateCategory(editingCategoryId, { name: categoryName, parentId: categoryParentId || undefined, active: true }); setNotice('Category updated') } else { await createCategory(categoryName, categoryParentId || undefined); setNotice('Category added') } setCategoryName(''); setCategoryParentId(''); setEditingCategoryId(null); setBootstrap(await fetchPosBootstrap()) } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Category could not be saved') } }
  const editCategory = (category: Category) => { setEditingCategoryId(category.id); setCategoryName(category.name); setCategoryParentId(category.parentId || '') }
  const deactivateCategory = async (category: Category) => { try { await updateCategory(category.id, { name: category.name, parentId: category.parentId, active: false }); setNotice('Category deactivated'); setBootstrap(await fetchPosBootstrap()) } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Category could not be deactivated') } }
  const cancelCategoryEdit = () => { setEditingCategoryId(null); setCategoryName(''); setCategoryParentId('') }
  const addProduct = async (event: React.FormEvent) => { event.preventDefault(); try { await createProduct({ ...productForm, price: Number(productForm.price), gstRate: Number(productForm.gstRate || 0) }); setProductForm({ sku: '', name: '', categoryId: '', price: '', unit: 'each', productType: 'MENU_ITEM', hsnCode: '', gstRate: '', trackInventory: false }); setNotice('Product added'); setBootstrap(await fetchPosBootstrap()) } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Product could not be added') } }
  const saveProduct = async (event: React.FormEvent) => { event.preventDefault(); if (!editingProductId) return addProduct(event); try { await updateProduct(editingProductId, { ...productForm, price: Number(productForm.price), gstRate: Number(productForm.gstRate || 0), active: true }); setEditingProductId(null); setProductForm({ sku: '', name: '', categoryId: '', price: '', unit: 'each', productType: 'MENU_ITEM', hsnCode: '', gstRate: '', trackInventory: false }); setNotice('Product updated'); setBootstrap(await fetchPosBootstrap()) } catch (caught) { setNotice(caught instanceof Error ? caught.message : 'Product could not be updated') } }
  const editProduct = (product: Product) => { setEditingProductId(product.id); setProductForm({ sku: product.sku, name: product.name, categoryId: product.categoryId, price: String(product.price), unit: product.unit, productType: product.productType, hsnCode: product.hsnCode || '', gstRate: String(product.gstRate), trackInventory: product.trackInventory }) }
  const cancelProductEdit = () => { setEditingProductId(null); setProductForm({ sku: '', name: '', categoryId: '', price: '', unit: 'each', productType: 'MENU_ITEM', hsnCode: '', gstRate: '', trackInventory: false }) }

  if (loading) return <main className="login-screen"><section className="login-card"><div className="brand-mark">CP</div><p className="eyebrow">Counterpoint cloud POS</p><h1>Loading secure workspace</h1><p className="login-copy">Resolving your organization, location, catalog, and permissions.</p></section></main>
  if (!actor || !bootstrap) return <main className="login-screen"><section className="login-card"><div className="brand-mark">CP</div><p className="eyebrow">Counterpoint cloud POS</p><h1>{isLocalDevelopment ? 'Local development access' : 'Sign in to continue'}</h1><p className="login-copy">{isLocalDevelopment ? 'Using the guarded Development-only actor. No Microsoft Entra login is required locally.' : 'Use your Microsoft Entra account. POS transactions require a live connection to the cloud service.'}</p>{error && <p className="form-error">{error}</p>}<button className="primary-button" onClick={() => isLocalDevelopment ? void load() : void startEntraLogin().catch(caught => setError(caught instanceof Error ? caught.message : 'Sign-in could not start'))}>{isLocalDevelopment ? 'Continue locally' : 'Sign in with Microsoft'}</button></section></main>

  return <div className="operations-app">
    <header className="operations-header"><div><div className="brand-line"><span className="brand-mark">CP</span><strong>Counterpoint</strong></div><span className="location-label">{actor.locationId} · {registerCode}</span></div><div className="session"><span className="online-dot" />{actor.displayName}<span className="role-badge">{actor.role}</span><button onClick={signOut}>Sign out</button></div></header>
    <main className="operations-main phase1-main">
      <div className="page-title"><div><h1>Point of sale</h1></div></div>
      <div className="report-tabs primary-menu"><button className={mode === 'pos' ? 'active' : ''} onClick={() => setMode('pos')}>POS</button>{actor.role !== 'Cashier' && actor.role !== 'CounterStaff' && <button className={mode === 'kds' ? 'active' : ''} onClick={() => setMode('kds')}>KDS</button>}{(actor.role === 'OrganizationOwner' || actor.role === 'OperationsManager' || actor.role === 'StoreManager' || isLocalDevelopment) && <><button className={mode === 'catalog' ? 'active' : ''} onClick={() => setMode('catalog')}>Catalog</button><button className={mode === 'operations' ? 'active' : ''} onClick={() => setMode('operations')}>Operations</button></>}{actor.role === 'Cashier' && <button className={mode === 'operations' ? 'active' : ''} onClick={() => setMode('operations')}>Purchases</button>}</div>
      {mode === 'kds' ? <KdsView items={kdsItems} onStatus={async (id, status) => { await updateKdsStatus(id, status); setKdsItems(await fetchActiveKds()) }} /> : mode === 'catalog' ? <CatalogView bootstrap={bootstrap} categoryName={categoryName} categoryParentId={categoryParentId} setCategoryName={setCategoryName} setCategoryParentId={setCategoryParentId} addCategory={saveCategory} editingCategoryId={editingCategoryId} onEditCategory={editCategory} onDeactivateCategory={deactivateCategory} onCancelCategoryEdit={cancelCategoryEdit} productForm={productForm} setProductForm={setProductForm} addProduct={saveProduct} editingProductId={editingProductId} onEdit={editProduct} onCancelEdit={cancelProductEdit} /> : mode === 'operations' ? <OperationsView bootstrap={bootstrap} locationId={actor.locationId} role={actor.role} initialTab={actor.role === 'Cashier' ? 'purchases' : 'inventory'} onNotice={setNotice} /> : <>
      <div className="phase1-layout">
        <section><div className="section-heading"><div><p className="eyebrow">Catalog</p><h2>Select products</h2></div><button className="secondary-button" onClick={() => void load()}>Refresh</button></div><div className="catalog-filters"><input className="wide-search" placeholder="Search SKU or product" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Filter catalog by inventory" value={inventoryOnly ? 'tracked' : ''} onChange={event => setInventoryOnly(event.target.value === 'tracked')}><option value="">All products</option><option value="tracked">Inventory tracked</option></select></div><div className="real-product-grid">{products.map(product => <button className="real-product" key={product.id} disabled={product.trackInventory && product.availableQuantity <= 0} onClick={() => addToCart(product)}><span>{product.sku}</span><strong>{product.name}</strong><small>{!product.trackInventory ? 'Prepared / no stock tracking' : `${money(product.price)} · ${product.availableQuantity} ${product.unit}`}</small></button>)}</div>{!products.length && <div className="empty-panel">No products are available at this location.</div>}</section>
        <aside className="sale-panel"><div className="panel-heading"><div><p className="eyebrow">Current order</p><h2>{cart.length ? `${cart.reduce((sum, line) => sum + line.quantity, 0)} items` : 'Empty order'}</h2></div><button onClick={() => setCart([])}>Clear</button></div><div className="sale-lines">{cart.map(line => <div className="sale-line" key={line.product.id}><div><strong>{line.product.name}</strong><small>{money(line.product.price)} each</small></div><div className="stepper"><button onClick={() => changeQuantity(line.product.id, -1)}>-</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, 1)} disabled={line.product.trackInventory && line.quantity >= line.product.availableQuantity}>+</button></div><b>{money(line.product.price * line.quantity)}</b></div>)}</div><div className="sale-total"><span>Subtotal</span><b>{money(subtotal)}</b><span>Tax</span><b>{money(tax)}</b><strong>Total</strong><strong>{money(total)}</strong></div><label className="payment-select">Payment<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="OTHER">Other</option></select></label><button className="primary-button" disabled={!cart.length} onClick={() => void completeSale()}>Take payment</button></aside>
      </div>
      </>}
    </main>
    {lastOrder && <div className="receipt-modal-backdrop"><section className="receipt-modal"><h2>Order {lastOrder.orderNumber}</h2><p>Payment recorded by the cloud service.</p><div><button className="primary-button" onClick={() => printReceipt(lastOrder)}>Print receipt</button><button className="secondary-button" onClick={() => setLastOrder(null)}>Close</button></div></section></div>}
    {notice && <div className="toast">{notice}</div>}
  </div>
}

function KdsView({ items, onStatus }: { items: KdsWorkItem[]; onStatus: (id: string, status: string) => Promise<void> }) {
  const nextStatus: Record<string, string | undefined> = { PENDING: 'ACCEPTED', QUEUED: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' }
  return <section className="kds-screen"><div className="panel-heading"><div><p className="eyebrow">Persistent SQL work queue</p><h2>Kitchen display</h2></div><span>{items.length} active</span></div>{items.length ? <div className="kds-grid">{items.map(item => <article className="kds-item" key={item.id}><span>{item.stationCode} · {item.orderNumber}</span><strong>{item.productName}</strong><small>{item.quantity} · {item.status}</small>{nextStatus[item.status] && <button className="primary-button" onClick={() => void onStatus(item.id, nextStatus[item.status]!)}>{nextStatus[item.status]}</button>}</article>)}</div> : <div className="empty-panel">No active preparation work. Refresh recovery state from SQL.</div>}</section>
}

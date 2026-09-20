import { useEffect, useMemo, useState } from 'react'
import { addStockMovement, createLocalOrder, createLocation, createOrder, createProduct, createRecipe, createVendor, currentUser, fetchCategories, fetchInventory, fetchLocalProducts, fetchOrders, fetchOrganization, fetchProducts, fetchReorderItems, fetchRecipes, fetchLocations, fetchRegisters, fetchUsers, fetchVendors, login, produceBatch, receivePurchase, sendReceipt, syncCatalogToAgent, syncLocalOrdersToCloud, updateLocationStatus, updateProduct, updateProductStatus, updateReorderLevel, updateUserStatus, type Category, type InventoryItem, type LocalOrder, type Order, type Product, type Recipe, type User, type Organization, type Location, type Register, type UserSummary, type Vendor } from './lib/api'
import { clearToken } from './lib/api'
import './styles.css'

type CartLine = { product: Product; quantity: number }
const money = (value: number) => `$${value.toFixed(2)}`

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ username: 'cashier', password: 'cashier123' })
  const [loginError, setLoginError] = useState('')
  const [section, setSection] = useState<'pos' | 'inventory' | 'catalog' | 'reorder' | 'production' | 'orders' | 'purchase' | 'reports' | 'admin'>('pos')
  const [openGroup, setOpenGroup] = useState('workspace')
  const [products, setProducts] = useState<Product[]>([])
  const [localProducts, setLocalProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [reorders, setReorders] = useState<InventoryItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [registers, setRegisters] = useState<Register[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [language, setLanguage] = useState<'en' | 'ta'>('en')
  const [locationForm, setLocationForm] = useState({ name: '', type: 'store' })
  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [receiptText, setReceiptText] = useState('')
  const [productForm, setProductForm] = useState({ sku: '', name: '', categoryId: 0, price: '', unit: 'each', inventoryMode: 'stocked', barcode: '', description: '', purchasePrice: '', vendorId: 0, origin: '', taxRate: '', hsnCode: '', gstRate: '', cgstRate: '', sgstRate: '' })
  const [stockForm, setStockForm] = useState({ productId: 0, quantity: '', reorderLevel: '' })
  const [productionForm, setProductionForm] = useState({ name: '', outputProductId: 0, ingredientProductId: 0, quantityPerUnit: '', batchQuantity: '', expiresAt: '' })
  const [vendorForm, setVendorForm] = useState({ name: '', displayName: '', email: '', phone: '', gstin: '', address: '', paymentTerms: '' })
  const [purchaseForm, setPurchaseForm] = useState({ vendorId: 0, reference: '', productId: 0, quantity: '', unitCost: '', batchNumber: '', expiryDate: '' })

  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const labels = language === 'ta' ? { pos: 'விற்பனை', orders: 'விற்பனை வரலாறு', catalog: 'பொருள் பட்டியல்', inventory: 'சரக்கு பெறுதல்', production: 'தயாரிப்பு', reorder: 'மறுவரிசை', purchase: 'கொள்முதல்', reports: 'அறிக்கைகள்', admin: 'நிர்வாகம்', sync: 'பதிவேட்டை ஒத்திசை', signOut: 'வெளியேறு', administration: 'நிர்வாகம்' } : { pos: 'POS sale', orders: 'Sales history', catalog: 'Catalog', inventory: 'Stock receiving', production: 'Prepared production', reorder: 'Reorder queue', purchase: 'Purchase', reports: 'Reports', admin: 'Administration', sync: 'Sync register', signOut: 'Sign out', administration: 'Administration' }
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 2600) }
  const loadData = async () => {
    const [loadedProducts, loadedCategories, loadedInventory, loadedOrders] = await Promise.all([fetchProducts(), fetchCategories(), fetchInventory(), fetchOrders()])
    setProducts(loadedProducts); setCategories(loadedCategories); setInventory(loadedInventory); setOrders(loadedOrders)
    fetchLocalProducts().then(setLocalProducts).catch(() => setLocalProducts([]))
    if (canManage) { setReorders(await fetchReorderItems()); setRecipes(await fetchRecipes()); setVendors(await fetchVendors()) }
    if (user?.role === 'admin') { setOrganization(await fetchOrganization()); setLocations(await fetchLocations()); setRegisters(await fetchRegisters()); setUsers(await fetchUsers()) }
  }
  useEffect(() => { currentUser().then(setUser).catch(() => setUser(null)) }, [])
  useEffect(() => { if (user) loadData().catch((error) => notify(error.message)) }, [user])

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query])
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0)
  const tax = Math.round(subtotal * 0.0825 * 100) / 100
  const total = subtotal + tax
  const addToCart = (product: Product) => setCart((current) => { const existing = current.find((line) => line.product.id === product.id); if (product.stock <= (existing?.quantity ?? 0)) { notify(`${product.name} has insufficient stock`); return current }; return existing ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }] })
  const changeQuantity = (productId: number, delta: number) => setCart((current) => current.map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0))

  const submitLogin = async (event: React.FormEvent) => { event.preventDefault(); try { setLoginError(''); setUser(await login(loginForm.username, loginForm.password)) } catch { setLoginError('Invalid credentials or API is offline') } }
  const submitProduct = async (event: React.FormEvent) => { event.preventDefault(); try { const input = { sku: productForm.sku, name: productForm.name, categoryId: productForm.categoryId, price: Number(productForm.price), unit: productForm.unit, active: true, inventoryMode: productForm.inventoryMode, barcode: productForm.barcode || undefined, description: productForm.description || undefined, purchasePrice: Number(productForm.purchasePrice || 0), vendorId: productForm.vendorId || undefined, origin: productForm.origin || undefined, taxRate: Number(productForm.taxRate || 0), hsnCode: productForm.hsnCode || undefined, gstRate: Number(productForm.gstRate || 0), cgstRate: Number(productForm.cgstRate || 0), sgstRate: Number(productForm.sgstRate || 0) }; await createProduct(input); setProductForm({ sku: '', name: '', categoryId: 0, price: '', unit: 'each', inventoryMode: 'stocked', barcode: '', description: '', purchasePrice: '', vendorId: 0, origin: '', taxRate: '', hsnCode: '', gstRate: '', cgstRate: '', sgstRate: '' }); await loadData(); notify('Item added to catalog') } catch (error) { notify(error instanceof Error ? error.message : 'Could not add item') } }
  const submitStock = async (event: React.FormEvent) => { event.preventDefault(); try { await addStockMovement({ productId: stockForm.productId, locationId: user!.locationId, quantity: Number(stockForm.quantity), type: 'stock-receipt', reason: 'Phase 1 receiving' }); if (stockForm.reorderLevel) await updateReorderLevel(stockForm.productId, user!.locationId, Number(stockForm.reorderLevel)); await loadData(); setStockForm({ productId: 0, quantity: '', reorderLevel: '' }); notify('Inventory updated') } catch (error) { notify(error instanceof Error ? error.message : 'Could not update inventory') } }
  const completeSale = async () => { try { const order = await createOrder({ registerId: 'register-03', orderType: 'counter-sale', paymentMethod: 'card', lines: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }); const printed = await sendReceipt(order); setCart([]); await loadData(); notify(printed ? `Sale ${order.orderNumber} completed and receipt queued` : `Sale ${order.orderNumber} completed; printer unavailable`) } catch (error) { notify(error instanceof Error ? error.message : 'Sale failed') } }
  const completeLocalSale = async () => { try { const localOrder: LocalOrder = { id: crypto.randomUUID(), orderNumber: `LOCAL-${Date.now()}`, registerId: 'register-03', paymentMethod: 'card', total, status: 'queued', createdAt: new Date().toISOString(), lines: cart.map((line) => ({ productId: line.product.id, name: line.product.name, quantity: line.quantity, unitPrice: line.product.price })) }; const saved = await createLocalOrder(localOrder); const printable: Order = { id: saved.id, orderNumber: saved.orderNumber, registerId: saved.registerId, orderType: 'counter-sale', paymentMethod: saved.paymentMethod, status: 'paid', subtotal, tax, total: saved.total, createdAt: saved.createdAt, lines: saved.lines }; const printed = await sendReceipt(printable); setReceiptText([`COUNTERPOINT POS`, `Order: ${saved.orderNumber}`, `Register: ${saved.registerId}`, '', ...saved.lines.map((line) => `${line.quantity} x ${line.name}  ${money(line.unitPrice)}`), '', `TOTAL: ${money(saved.total)}`].join('\n')); setCart([]); await loadData(); notify(printed ? `Sale saved locally and receipt queued` : `Sale saved locally; printer unavailable`) } catch (error) { notify(error instanceof Error ? error.message : 'Local sale failed') } }
  const syncRegister = async () => { try { const catalog = await fetchProducts(); const catalogResult = await syncCatalogToAgent(catalog); const accepted = await syncLocalOrdersToCloud(); await loadData(); notify(`Register synced: ${catalogResult.accepted} items, ${accepted} sales`) } catch (error) { notify(error instanceof Error ? error.message : 'Register sync failed') } }
  const toggleProduct = async (id: number, active: boolean) => { await updateProductStatus(id, active); await loadData(); notify(active ? 'Item activated' : 'Item deactivated') }
  const toggleLocation = async (id: number, active: boolean) => { await updateLocationStatus(id, active); await loadData(); notify(active ? 'Location activated' : 'Location deactivated') }
  const submitLocation = async (event: React.FormEvent) => { event.preventDefault(); await createLocation(locationForm); setLocationForm({ name: '', type: 'store' }); await loadData(); notify('Business location added') }
  const downloadReceipt = () => { const blob = new Blob([receiptText], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'receipt.txt'; link.click(); URL.revokeObjectURL(url) }
  const submitProduction = async (event: React.FormEvent) => { event.preventDefault(); try { const recipe = await createRecipe({ name: productionForm.name, outputProductId: productionForm.outputProductId, ingredients: [{ productId: productionForm.ingredientProductId, quantityPerUnit: Number(productionForm.quantityPerUnit), unit: 'each' }] }); await produceBatch({ recipeId: recipe.id, locationId: user!.locationId, quantityProduced: Number(productionForm.batchQuantity), expiresAt: productionForm.expiresAt ? new Date(productionForm.expiresAt).toISOString() : undefined }); await loadData(); notify('Prepared batch produced and ingredient stock deducted') } catch (error) { notify(error instanceof Error ? error.message : 'Production failed') } }
  const submitVendor = async (event: React.FormEvent) => { event.preventDefault(); try { await createVendor({ name: vendorForm.name, displayName: vendorForm.displayName, email: vendorForm.email || undefined, phone: vendorForm.phone || undefined, gstin: vendorForm.gstin || undefined, address: vendorForm.address || undefined, paymentTerms: vendorForm.paymentTerms || undefined }); setVendorForm({ name: '', displayName: '', email: '', phone: '', gstin: '', address: '', paymentTerms: '' }); await loadData(); notify('Vendor added') } catch (error) { notify(error instanceof Error ? error.message : 'Could not add vendor') } }
  const submitPurchase = async (event: React.FormEvent) => { event.preventDefault(); try { await receivePurchase({ vendorId: purchaseForm.vendorId, locationId: user!.locationId, reference: purchaseForm.reference || `PO-${Date.now()}`, lines: [{ productId: purchaseForm.productId, quantity: Number(purchaseForm.quantity), unitCost: Number(purchaseForm.unitCost), batchNumber: purchaseForm.batchNumber || undefined, expiryDate: purchaseForm.expiryDate ? new Date(purchaseForm.expiryDate).toISOString() : undefined }] }); setPurchaseForm({ vendorId: 0, reference: '', productId: 0, quantity: '', unitCost: '', batchNumber: '', expiryDate: '' }); await loadData(); notify('Purchase received and stock updated') } catch (error) { notify(error instanceof Error ? error.message : 'Could not receive purchase') } }

  if (!user) return <div className="login-screen"><div className="login-card"><div className="brand-mark">CP</div><p className="eyebrow">Counterpoint operations</p><h1>Sign in to continue</h1><p className="login-copy">Use your assigned role to access POS, inventory, and catalog operations.</p><form onSubmit={submitLogin}><label>Username<input value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} /></label><label>Password<input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} /></label>{loginError && <p className="form-error">{loginError}</p>}<button className="primary-button">Sign in</button></form><small>Development accounts: admin / admin123, manager / manager123, cashier / cashier123</small></div></div>

  const sectionLabel: Record<string, string> = { pos: labels.pos, orders: labels.orders, catalog: labels.catalog, inventory: labels.inventory, production: labels.production, reorder: labels.reorder, purchase: labels.purchase, reports: labels.reports, admin: labels.admin }
  type NavItem = { key: typeof section; label: string; badge?: number }
  const navGroups: Array<{ key: string; label: string; visible: boolean; items: NavItem[] }> = [
    { key: 'workspace', label: 'Workspace', visible: true, items: [{ key: 'pos', label: labels.pos }] },
    { key: 'inventory', label: 'Inventory', visible: canManage, items: [{ key: 'catalog', label: labels.catalog }, { key: 'inventory', label: labels.inventory }, { key: 'production', label: labels.production }, { key: 'reorder', label: labels.reorder, badge: reorders.length }] },
    { key: 'purchase', label: 'Purchase', visible: canManage, items: [{ key: 'purchase', label: labels.purchase }] },
    { key: 'reports', label: 'Reports', visible: canManage, items: [{ key: 'orders', label: labels.orders }, { key: 'reports', label: labels.reports }] },
    { key: 'admin', label: 'Admin', visible: user.role === 'admin', items: [{ key: 'admin', label: labels.administration }] },
  ]

  return <div className="operations-app">
    <header className="operations-header">
      <div>
        <div className="brand-line"><span className="brand-mark">CP</span><strong>Counterpoint</strong></div>
        <span className="location-label">Downtown Cafe · Register 03</span>
      </div>
      <div className="session">
        <button className="language-switch" onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}>{language === 'en' ? 'தமிழ்' : 'English'}</button>
        <span className="online-dot" />
        {user.displayName}
        <span className="role-badge">{user.role}</span>
        {user.role === 'admin' && <button onClick={syncRegister}>{labels.sync}</button>}
        <button onClick={() => { clearToken(); setUser(null) }}>{labels.signOut}</button>
      </div>
    </header>
    <div className="operations-body">
      <nav className="operations-nav">
        {navGroups.filter((group) => group.visible).map((group) => <div className="nav-group" key={group.key}>
          <button type="button" className={`nav-group-header ${openGroup === group.key ? 'open' : ''}`} onClick={() => setOpenGroup(openGroup === group.key ? '' : group.key)}>
            <span>{group.label}</span><span className="nav-chevron">{openGroup === group.key ? '▾' : '▸'}</span>
          </button>
          {openGroup === group.key && <div className="nav-group-items">
            {group.items.map((item) => <button key={item.key} className={section === item.key ? 'active' : ''} onClick={() => setSection(item.key)}>{item.label}{typeof item.badge === 'number' && <b>{item.badge}</b>}</button>)}
          </div>}
        </div>)}
      </nav>
      <main className="operations-main">
        <div className="page-title">
          <div>
            <p className="eyebrow">{section === 'pos' ? 'Counter sale' : section.replace('-', ' ')}</p>
            <h1>{sectionLabel[section]}</h1>
          </div>
          <span className="data-status">Local SQLite · PostgreSQL sync</span>
        </div>
        {section === 'pos' && <PosView products={localProducts.length ? localProducts : filteredProducts} query={query} setQuery={setQuery} addToCart={addToCart} cart={cart} changeQuantity={changeQuantity} clearCart={() => setCart([])} subtotal={subtotal} tax={tax} total={total} completeSale={completeLocalSale} />}
        {section === 'catalog' && <CatalogView products={products} categories={categories} vendors={vendors} form={productForm} setForm={(form) => setProductForm({ ...productForm, ...form })} submit={submitProduct} />}
        {section === 'inventory' && <InventoryView inventory={inventory} products={products} form={stockForm} setForm={setStockForm} submit={submitStock} />}
        {section === 'production' && <ProductionView products={products} recipes={recipes} form={productionForm} setForm={setProductionForm} submit={submitProduction} />}
        {section === 'reorder' && <ReorderView items={reorders} />}
        {section === 'orders' && <OrdersView orders={orders} />}
        {section === 'purchase' && <PurchaseView vendors={vendors} products={products} vendorForm={vendorForm} setVendorForm={setVendorForm} submitVendor={submitVendor} purchaseForm={purchaseForm} setPurchaseForm={setPurchaseForm} submitPurchase={submitPurchase} />}
        {section === 'reports' && <ReportsView orders={orders} inventory={inventory} />}
        {section === 'admin' && <AdminView organization={organization} locations={locations} registers={registers} users={users} products={products} toggleProduct={toggleProduct} toggleLocation={toggleLocation} toggleUser={async (id, active) => { await updateUserStatus(id, active); setUsers(await fetchUsers()) }} locationForm={locationForm} setLocationForm={setLocationForm} submitLocation={submitLocation} />}
      </main>
    </div>
    {receiptText && <div className="receipt-modal-backdrop"><section className="receipt-modal"><h2>Receipt preview</h2><pre>{receiptText}</pre><div><button className="primary-button" onClick={() => window.print()}>Print / Save PDF</button><button className="secondary-button" onClick={downloadReceipt}>Download TXT</button><button className="secondary-button" onClick={() => setReceiptText('')}>Close</button></div></section></div>}
    {notice && <div className="toast">{notice}</div>}
  </div>
}

function PosView({ products, query, setQuery, addToCart, cart, changeQuantity, clearCart, subtotal, tax, total, completeSale }: { products: Product[]; query: string; setQuery: (value: string) => void; addToCart: (product: Product) => void; cart: CartLine[]; changeQuantity: (id: number, delta: number) => void; clearCart: () => void; subtotal: number; tax: number; total: number; completeSale: () => void }) { return <div className="pos-layout"><section><input className="wide-search" placeholder="Search SKU or product name" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="real-product-grid">{products.map((product) => <button className={`real-product ${product.stock <= 0 ? 'out-of-stock' : ''}`} key={product.id} disabled={product.stock <= 0} onClick={() => addToCart(product)}><span>{product.sku}</span><strong>{product.name}</strong><small>{money(product.price)} · {product.stock} {product.unit} available</small></button>)}</div>{!products.length && <div className="empty-panel">No catalog items match this search.</div>}</section><aside className="sale-panel"><div className="panel-heading"><div><p className="eyebrow">Current sale</p><h2>{cart.length ? `${cart.reduce((sum, line) => sum + line.quantity, 0)} items` : 'Empty sale'}</h2></div><button onClick={clearCart}>Clear</button></div><div className="sale-lines">{cart.map((line) => <div className="sale-line" key={line.product.id}><div><strong>{line.product.name}</strong><small>{money(line.product.price)} each</small></div><div className="stepper"><button onClick={() => changeQuantity(line.product.id, -1)}>−</button><span>{line.quantity}</span><button disabled={line.quantity >= line.product.stock} onClick={() => changeQuantity(line.product.id, 1)}>+</button></div><b>{money(line.product.price * line.quantity)}</b></div>)}</div><div className="sale-total"><span>Subtotal</span><b>{money(subtotal)}</b><span>Tax</span><b>{money(tax)}</b><strong>Total</strong><strong>{money(total)}</strong></div><button className="primary-button" disabled={!cart.length} onClick={completeSale}>Complete sale · {money(total)}</button></aside></div> }
type CatalogForm = { sku: string; name: string; categoryId: number; price: string; unit: string; inventoryMode: string; barcode: string; description: string; purchasePrice: string; vendorId: number; origin: string; taxRate: string; hsnCode: string; gstRate: string; cgstRate: string; sgstRate: string }
function CatalogView({ products, categories, vendors, form, setForm, submit }: { products: Product[]; categories: Category[]; vendors: Vendor[]; form: CatalogForm; setForm: (form: CatalogForm) => void; submit: (event: React.FormEvent) => void }) {
  return <div className="management-grid catalog-grid">
    <form className="form-panel item-details-form" onSubmit={submit}>
      <h2 className="wide-field">Add catalog item</h2>
      <p className="wide-field">Item master data, pricing, tax, and vendor details live together here — no separate screen.</p>
      <label>Item name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>SKU / code<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
      <label>Barcode<input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></label>
      <label>HSN code<input value={form.hsnCode} onChange={(event) => setForm({ ...form, hsnCode: event.target.value })} /></label>
      <label>Category<select required value={form.categoryId || ''} onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })}><option value="" disabled>Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Inventory mode<select value={form.inventoryMode} onChange={(event) => setForm({ ...form, inventoryMode: event.target.value })}><option value="stocked">Purchased / stocked item</option><option value="prepared">Prepared menu item</option></select></label>
      <label>Unit<input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
      <label>Sale price<input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
      <label>Purchase price<input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} /></label>
      <label>Tax rate (%)<input type="number" min="0" step="0.001" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} /></label>
      <label>GST (%)<input type="number" min="0" step="0.001" value={form.gstRate} onChange={(event) => setForm({ ...form, gstRate: event.target.value })} /></label>
      <label>CGST (%)<input type="number" min="0" step="0.001" value={form.cgstRate} onChange={(event) => setForm({ ...form, cgstRate: event.target.value })} /></label>
      <label>SGST (%)<input type="number" min="0" step="0.001" value={form.sgstRate} onChange={(event) => setForm({ ...form, sgstRate: event.target.value })} /></label>
      <label>Vendor<select value={form.vendorId || ''} onChange={(event) => setForm({ ...form, vendorId: Number(event.target.value) })}><option value="">No vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>)}</select></label>
      <label>Origin<input value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} /></label>
      <label className="wide-field">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <button className="primary-button wide-field">Add item</button>
    </form>
    <DataTable title="Current catalog" headers={['SKU', 'Name', 'Category', 'Mode', 'Price', 'HSN']} rows={products.map((product) => [product.sku, product.name, product.category, product.inventoryMode, money(product.price), product.hsnCode ?? '—'])} />
  </div>
}

function InventoryView({ inventory, products, form, setForm, submit }: { inventory: InventoryItem[]; products: Product[]; form: { productId: number; quantity: string; reorderLevel: string }; setForm: (form: { productId: number; quantity: string; reorderLevel: string }) => void; submit: (event: React.FormEvent) => void }) { return <div className="management-grid"><form className="form-panel" onSubmit={submit}><h2>Receive stock</h2><p>Every receipt creates an auditable stock movement.</p><label>Item<select required value={form.productId} onChange={(event) => setForm({ ...form, productId: Number(event.target.value) })}><option value={0}>Choose item</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label><label>Quantity received<input required type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Reorder level<input type="number" min="0" step="0.001" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} /></label><button className="primary-button">Post stock receipt</button></form><DataTable title="Location stock" headers={['SKU', 'Item', 'On hand', 'Reorder', 'Status']} rows={inventory.map((item) => [item.sku, item.productName, `${item.onHand} ${item.unit}`, `${item.reorderLevel}`, item.needsReorder ? 'REORDER' : 'Healthy'])} /></div> }
function ProductionView({ products, recipes, form, setForm, submit }: { products: Product[]; recipes: Recipe[]; form: { name: string; outputProductId: number; ingredientProductId: number; quantityPerUnit: string; batchQuantity: string; expiresAt: string }; setForm: (form: { name: string; outputProductId: number; ingredientProductId: number; quantityPerUnit: string; batchQuantity: string; expiresAt: string }) => void; submit: (event: React.FormEvent) => void }) { const prepared = products.filter((product) => product.inventoryMode === 'prepared'); const raw = products.filter((product) => product.inventoryMode !== 'prepared'); return <div className="management-grid"><form className="form-panel" onSubmit={submit}><h2>Produce prepared menu item</h2><p>Consume raw stock and create sellable prepared stock in one transaction.</p><label>Batch name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Prepared item<select required value={form.outputProductId} onChange={(event) => setForm({ ...form, outputProductId: Number(event.target.value) })}><option value={0}>Choose menu item</option>{prepared.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Raw ingredient<select required value={form.ingredientProductId} onChange={(event) => setForm({ ...form, ingredientProductId: Number(event.target.value) })}><option value={0}>Choose ingredient</option>{raw.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Ingredient quantity per item<input required type="number" min="0.001" step="0.001" value={form.quantityPerUnit} onChange={(event) => setForm({ ...form, quantityPerUnit: event.target.value })} /></label><label>Batch quantity<input required type="number" min="1" step="1" value={form.batchQuantity} onChange={(event) => setForm({ ...form, batchQuantity: event.target.value })} /></label><label>Expiry<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label><button className="primary-button">Produce batch</button></form><DataTable title="Recipes" headers={['Recipe', 'Output', 'Ingredients']} rows={recipes.map((recipe) => [recipe.name, products.find((product) => product.id === recipe.outputProductId)?.name ?? 'Unknown', `${recipe.ingredients.length}`])} empty="No recipes created yet." /></div> }

type VendorForm = { name: string; displayName: string; email: string; phone: string; gstin: string; address: string; paymentTerms: string }
type PurchaseForm = { vendorId: number; reference: string; productId: number; quantity: string; unitCost: string; batchNumber: string; expiryDate: string }
function PurchaseView({ vendors, products, vendorForm, setVendorForm, submitVendor, purchaseForm, setPurchaseForm, submitPurchase }: { vendors: Vendor[]; products: Product[]; vendorForm: VendorForm; setVendorForm: (form: VendorForm) => void; submitVendor: (event: React.FormEvent) => void; purchaseForm: PurchaseForm; setPurchaseForm: (form: PurchaseForm) => void; submitPurchase: (event: React.FormEvent) => void }) {
  return <div className="admin-grid">
    <form className="form-panel item-details-form" onSubmit={submitVendor}>
      <h2 className="wide-field">Add vendor</h2>
      <p className="wide-field">Vendors feed both catalog sourcing and purchase receiving below.</p>
      <label>Vendor code<input required value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} /></label>
      <label>Display name<input required value={vendorForm.displayName} onChange={(event) => setVendorForm({ ...vendorForm, displayName: event.target.value })} /></label>
      <label>Email<input type="email" value={vendorForm.email} onChange={(event) => setVendorForm({ ...vendorForm, email: event.target.value })} /></label>
      <label>Phone<input value={vendorForm.phone} onChange={(event) => setVendorForm({ ...vendorForm, phone: event.target.value })} /></label>
      <label>GSTIN<input value={vendorForm.gstin} onChange={(event) => setVendorForm({ ...vendorForm, gstin: event.target.value })} /></label>
      <label>Payment terms<input value={vendorForm.paymentTerms} onChange={(event) => setVendorForm({ ...vendorForm, paymentTerms: event.target.value })} /></label>
      <label className="wide-field">Address<textarea value={vendorForm.address} onChange={(event) => setVendorForm({ ...vendorForm, address: event.target.value })} /></label>
      <button className="primary-button wide-field">Add vendor</button>
    </form>
    <DataTable title="Vendors" headers={['Name', 'Display name', 'Email', 'Phone', 'Status']} rows={vendors.map((vendor) => [vendor.name, vendor.displayName, vendor.email ?? '—', vendor.phone ?? '—', vendor.active ? 'Active' : 'Inactive'])} empty="No vendors added yet." />
    <form className="form-panel item-details-form" onSubmit={submitPurchase}>
      <h2 className="wide-field">Receive purchase</h2>
      <p className="wide-field">Posting a receipt increases on-hand stock at your location immediately.</p>
      <label>Vendor<select required value={purchaseForm.vendorId || ''} onChange={(event) => setPurchaseForm({ ...purchaseForm, vendorId: Number(event.target.value) })}><option value="" disabled>Choose vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>)}</select></label>
      <label>Reference<input placeholder="PO number" value={purchaseForm.reference} onChange={(event) => setPurchaseForm({ ...purchaseForm, reference: event.target.value })} /></label>
      <label>Item<select required value={purchaseForm.productId || ''} onChange={(event) => setPurchaseForm({ ...purchaseForm, productId: Number(event.target.value) })}><option value="" disabled>Choose item</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label>
      <label>Quantity<input required type="number" min="0.001" step="0.001" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} /></label>
      <label>Unit cost<input required type="number" min="0" step="0.01" value={purchaseForm.unitCost} onChange={(event) => setPurchaseForm({ ...purchaseForm, unitCost: event.target.value })} /></label>
      <label>Batch number<input value={purchaseForm.batchNumber} onChange={(event) => setPurchaseForm({ ...purchaseForm, batchNumber: event.target.value })} /></label>
      <label>Expiry<input type="date" value={purchaseForm.expiryDate} onChange={(event) => setPurchaseForm({ ...purchaseForm, expiryDate: event.target.value })} /></label>
      <button className="primary-button wide-field">Post purchase receipt</button>
    </form>
  </div>
}

function ReportsView({ orders, inventory }: { orders: Order[]; inventory: InventoryItem[] }) {
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0)
  return <div className="admin-grid">
    <section className="table-panel">
      <div className="panel-heading"><h2>Sales summary</h2></div>
      <div className="admin-summary"><strong>{money(totalSales)}</strong><span>{orders.length} orders recorded</span><small>Total sales value across all synced orders.</small></div>
    </section>
    <DataTable title="Sales by order" headers={['Order', 'Register', 'Status', 'Total', 'Created']} rows={orders.map((order) => [order.orderNumber, order.registerId, order.status, money(order.total), new Date(order.createdAt).toLocaleString()])} empty="No sales recorded yet." />
    <DataTable title="Inventory summary" headers={['SKU', 'Item', 'On hand', 'Reorder', 'Status']} rows={inventory.map((item) => [item.sku, item.productName, `${item.onHand} ${item.unit}`, `${item.reorderLevel}`, item.needsReorder ? 'REORDER' : 'Healthy'])} empty="No inventory recorded yet." />
  </div>
}

function ReorderView({ items }: { items: InventoryItem[] }) { return <DataTable title="Reorder queue" headers={['SKU', 'Item', 'On hand', 'Reorder level', 'Location']} rows={items.map((item) => [item.sku, item.productName, `${item.onHand} ${item.unit}`, `${item.reorderLevel}`, item.locationName])} empty="No items currently need reordering." /> }
function OrdersView({ orders }: { orders: Order[] }) { return <DataTable title="Recent sales" headers={['Order', 'Register', 'Status', 'Total', 'Created']} rows={orders.map((order) => [order.orderNumber, order.registerId, order.status, money(order.total), new Date(order.createdAt).toLocaleString()])} empty="No sales recorded yet." /> }
function AdminView({ organization, locations, registers, users, products, toggleProduct, toggleLocation, toggleUser, locationForm, setLocationForm, submitLocation }: { organization: Organization | null; locations: Location[]; registers: Register[]; users: UserSummary[]; products: Product[]; toggleProduct: (id: number, active: boolean) => Promise<void>; toggleLocation: (id: number, active: boolean) => Promise<void>; toggleUser: (id: number, active: boolean) => Promise<void>; locationForm: { name: string; type: string }; setLocationForm: (form: { name: string; type: string }) => void; submitLocation: (event: React.FormEvent) => void }) { return <div className="admin-grid"><section className="table-panel"><div className="panel-heading"><h2>Organization</h2></div><div className="admin-summary"><strong>{organization?.name ?? 'Loading...'}</strong><span>{organization?.currency} · {organization?.timeZone}</span><small>Central organization settings and operational scope.</small></div></section><form className="form-panel" onSubmit={submitLocation}><h2>Add business location</h2><label>Name<input required value={locationForm.name} onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })} /></label><label>Type<select value={locationForm.type} onChange={(event) => setLocationForm({ ...locationForm, type: event.target.value })}><option value="store">Store</option><option value="cafe">Cafe</option><option value="farm">Farm</option><option value="warehouse">Warehouse</option></select></label><button className="primary-button">Add location</button></form><section className="table-panel"><div className="panel-heading"><h2>Business locations</h2><span>{locations.length} records</span></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>{locations.map((location) => <tr key={location.id}><td>{location.name}</td><td>{location.type}</td><td>{location.active ? 'Active' : 'Inactive'}</td><td><button className="table-action" onClick={() => toggleLocation(location.id, !location.active)}>{location.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></section><section className="table-panel"><div className="panel-heading"><h2>Catalog status</h2><span>{products.length} records</span></div><div className="table-scroll"><table><thead><tr><th>SKU</th><th>Name</th><th>Mode</th><th>Status</th><th>Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.sku}</td><td>{product.name}</td><td>{product.inventoryMode}</td><td>{product.active ? 'Active' : 'Inactive'}</td><td><button className="table-action" onClick={() => toggleProduct(product.id, !product.active)}>{product.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></section><DataTable title="Registers and devices" headers={['Register', 'Name', 'Device', 'Status']} rows={registers.map((register) => [register.registerId, register.name, register.deviceId, register.active ? 'Active' : 'Inactive'])} empty="No registers configured." /><section className="table-panel"><div className="panel-heading"><h2>Users and roles</h2><span>{users.length} records</span></div><div className="table-scroll"><table><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.username}</td><td>{user.displayName}</td><td>{user.role}</td><td>{user.active ? 'Active' : 'Inactive'}</td><td><button className="table-action" onClick={() => toggleUser(user.id, !user.active)}>{user.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></section></div> }
function DataTable({ title, headers, rows, empty = 'No records found.' }: { title: string; headers: string[]; rows: string[][]; empty?: string }) { return <section className="table-panel"><div className="panel-heading"><h2>{title}</h2><span>{rows.length} records</span></div>{rows.length ? <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="empty-panel">{empty}</div>}</section> }

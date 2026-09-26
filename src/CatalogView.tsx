import { useState } from "react";
import type { Category, PosBootstrap, Product } from "./lib/api";

type ProductForm = {
  sku: string;
  name: string;
  categoryId: string;
  price: string;
  unit: string;
  productType: string;
  hsnCode: string;
  gstRate: string;
  trackInventory: boolean;
};
type CatalogTab = "categories" | "products";

const productTypeHelp: Record<string, string> = {
  STOCKED_PRODUCT:
    "Raw material or purchased stock. Can be received into inventory.",
  MERCHANDISE:
    "Finished item purchased for resale. Can be received into inventory.",
  PREPARED_PRODUCT:
    "Made in the kitchen from raw materials. Not received directly.",
  MENU_ITEM:
    "Sellable prepared item such as coffee. No direct inventory balance.",
  SERVICE: "Non-physical service. No inventory balance.",
  NON_STOCK: "Sellable item that should never affect inventory.",
};

export function CatalogView({
  bootstrap,
  categoryName,
  categoryParentId,
  setCategoryName,
  setCategoryParentId,
  addCategory,
  editingCategoryId,
  onEditCategory,
  onDeactivateCategory,
  onCancelCategoryEdit,
  productForm,
  setProductForm,
  addProduct,
  editingProductId,
  onEdit,
  onCancelEdit,
}: {
  bootstrap: PosBootstrap;
  categoryName: string;
  categoryParentId: string;
  setCategoryName: (value: string) => void;
  setCategoryParentId: (value: string) => void;
  addCategory: (event: React.FormEvent) => void;
  editingCategoryId: string | null;
  onEditCategory: (category: Category) => void;
  onDeactivateCategory: (category: Category) => void;
  onCancelCategoryEdit: () => void;
  productForm: ProductForm;
  setProductForm: (value: ProductForm) => void;
  addProduct: (event: React.FormEvent) => void;
  editingProductId: string | null;
  onEdit: (product: Product) => void;
  onCancelEdit: () => void;
}) {
  const [tab, setTab] = useState<CatalogTab>("products");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [hsnFilter, setHsnFilter] = useState("");
  const updateForm = (changes: Partial<ProductForm>) =>
    setProductForm({ ...productForm, ...changes });
  const selectedType = productForm.productType;
  const inferredTrack =
    selectedType === "STOCKED_PRODUCT" || selectedType === "MERCHANDISE";
  const filteredProducts = bootstrap.products.filter(
    (product) =>
      `${product.name} ${product.sku}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!categoryFilter || product.categoryId === categoryFilter) &&
      (!hsnFilter ||
        (product.hsnCode || "")
          .toLowerCase()
          .includes(hsnFilter.toLowerCase())),
  );

  return (
    <section className="catalog-view">
      <div className="report-tabs catalog-tabs">
        <button
          className={tab === "categories" ? "active" : ""}
          onClick={() => setTab("categories")}
        >
          Categories
        </button>
        <button
          className={tab === "products" ? "active" : ""}
          onClick={() => setTab("products")}
        >
          Products
        </button>
      </div>
      {tab === "categories" && (
        <div className="admin-split">
          <form className="form-panel" onSubmit={addCategory}>
            <h2>{editingCategoryId ? "Edit category" : "Add category"}</h2>
            <p>
              Use departments and subcategories for Cafe, Grocery, Farm produce,
              and other areas.
            </p>
            <label>
              Name
              <input
                required
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>
            <label>
              Parent category
              <select
                value={categoryParentId}
                onChange={(event) => setCategoryParentId(event.target.value)}
              >
                <option value="">Top-level category</option>
                {bootstrap.categories
                  .filter((category) => category.id !== editingCategoryId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="primary-button">
                {editingCategoryId ? "Save category" : "Add category"}
              </button>
              {editingCategoryId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onCancelCategoryEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <section className="table-panel">
            <div className="panel-heading">
              <h2>Categories</h2>
              <span>{bootstrap.categories.length}</span>
            </div>
            <div className="category-list">
              {bootstrap.categories.map((category) => (
                <div className="category-row" key={category.id}>
                  <span>
                    {category.parentId ? "↳ " : ""}
                    {category.name}
                  </span>
                  <span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onEditCategory(category)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onDeactivateCategory(category)}
                    >
                      Deactivate
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {tab === "products" && (
        <div className="admin-split">
          <form className="form-panel" onSubmit={addProduct}>
            <h2>{editingProductId ? "Edit product" : "Add product"}</h2>
            <p>HSN, GST, CGST, and SGST are saved with the product.</p>
            <label>
              SKU
              <input
                required
                value={productForm.sku}
                onChange={(event) => updateForm({ sku: event.target.value })}
              />
            </label>
            <label>
              Name
              <input
                required
                value={productForm.name}
                onChange={(event) => updateForm({ name: event.target.value })}
              />
            </label>
            <label>
              Category
              <select
                required
                value={productForm.categoryId}
                onChange={(event) =>
                  updateForm({ categoryId: event.target.value })
                }
              >
                <option value="">Choose category</option>
                {bootstrap.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Price
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={productForm.price}
                onChange={(event) => updateForm({ price: event.target.value })}
              />
            </label>
            <label>
              Unit
              <input
                required
                value={productForm.unit}
                onChange={(event) => updateForm({ unit: event.target.value })}
              />
            </label>
            <label>
              HSN code
              <input
                value={productForm.hsnCode}
                onChange={(event) =>
                  updateForm({ hsnCode: event.target.value })
                }
              />
            </label>
            <label>
              GST (%)
              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.gstRate}
                onChange={(event) =>
                  updateForm({ gstRate: event.target.value })
                }
              />
            </label>
            <div className="tax-split">
              <label>
                CGST (%)
                <input
                  readOnly
                  value={(Number(productForm.gstRate || 0) / 2).toFixed(2)}
                />
              </label>
              <label>
                SGST (%)
                <input
                  readOnly
                  value={(Number(productForm.gstRate || 0) / 2).toFixed(2)}
                />
              </label>
            </div>
            <label>
              Product type
              <select
                value={selectedType}
                onChange={(event) =>
                  updateForm({
                    productType: event.target.value,
                    trackInventory:
                      event.target.value === "STOCKED_PRODUCT" ||
                      event.target.value === "MERCHANDISE",
                  })
                }
              >
                <option value="STOCKED_PRODUCT">Raw material / stocked</option>
                <option value="MERCHANDISE">Merchandise for resale</option>
                <option value="PREPARED_PRODUCT">Prepared product</option>
                <option value="MENU_ITEM">Prepared menu item</option>
                <option value="SERVICE">Service</option>
                <option value="NON_STOCK">Non-stock</option>
              </select>
            </label>
            <p className="type-help">{productTypeHelp[selectedType]}</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={productForm.trackInventory}
                onChange={(event) =>
                  updateForm({ trackInventory: event.target.checked })
                }
              />{" "}
              Track inventory for receiving and stock balances
            </label>
            {productForm.trackInventory !== inferredTrack && (
              <p className="form-warning">
                This differs from the usual setting for this product type.
              </p>
            )}
            <div className="form-actions">
              <button className="primary-button">
                {editingProductId ? "Save product" : "Add product"}
              </button>
              {editingProductId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onCancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <section className="table-panel">
            <div className="panel-heading">
              <h2>Products</h2>
              <span>
                {filteredProducts.length} of {bootstrap.products.length}
              </span>
            </div>
            <div className="filter-bar">
              <input
                placeholder="Filter name or SKU"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {bootstrap.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Filter HSN"
                value={hsnFilter}
                onChange={(event) => setHsnFilter(event.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Tax</th>
                    <th>Inventory</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>{product.sku}</td>
                      <td>{product.name}</td>
                      <td>{product.productType}</td>
                      <td>
                        HSN {product.hsnCode || "-"}
                        <br />
                        GST {product.gstRate.toFixed(2)}%<br />
                        CGST {product.cgstRate.toFixed(2)}% / SGST{" "}
                        {product.sgstRate.toFixed(2)}%
                      </td>
                      <td>
                        {product.trackInventory ? "Tracked" : "Not tracked"}
                      </td>
                      <td>{product.active ? "Active" : "Inactive"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onEdit(product)}
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
    </section>
  );
}

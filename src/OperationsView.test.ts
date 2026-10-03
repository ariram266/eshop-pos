import { describe, expect, it } from 'vitest'
import {
  calculateSalesLineAmounts,
  formatDateTimeInTimeZone,
  getSalesGroupKey,
  getBusinessDateKey,
  getBusinessDateRange,
  isPurchasableProduct,
  matchesProductSearch,
  productOptionValue,
  summarizePurchaseTotals,
  summarizeSalesTotals,
  sumSalesGroupQuantity,
} from './OperationsView'

describe('OperationsView helpers', () => {
  it('uses the organization timezone for business dates and date ranges', () => {
    const instant = '2026-10-01T19:00:00.000Z'
    expect(getBusinessDateKey(instant, 'Asia/Kolkata')).toBe('2026-10-02')
    expect(getBusinessDateRange('today', '', '', 'Asia/Kolkata', new Date(instant)))
      .toEqual({ from: '2026-10-02', to: '2026-10-02' })
    expect(formatDateTimeInTimeZone(instant, 'Asia/Kolkata')).not.toBe(
      formatDateTimeInTimeZone(instant, 'America/Chicago'),
    )
  })

  it('groups sales lines by payment type', () => {
    const item = {
      orderId: 'sale-1',
      orderNumber: 'INV-100',
      total: 100,
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentMethod: 'UPI',
      createdAt: '2026-10-02T10:00:00Z',
      lines: [],
    }
    const line = {
      productId: 'product-1',
      productName: 'Coffee',
      categoryName: 'Drinks',
      hsnCode: '2202',
      gstRate: 5,
      cgstRate: 2.5,
      sgstRate: 2.5,
      quantity: 1,
      unitPrice: 100,
      taxAmount: 5,
    }

    expect(getSalesGroupKey({ item, line }, 'paymentType')).toBe('UPI')
    expect(getSalesGroupKey({ item: { ...item, paymentMethod: 'CASH' }, line }, 'paymentType')).toBe('CASH')
  })

  it('sums quantities displayed in a sales group header', () => {
    const item = {
      orderId: 'sale-1',
      orderNumber: 'INV-101',
      total: 80,
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      createdAt: '2026-10-02T10:00:00Z',
      lines: [],
    }
    const line = {
      productId: 'product-1',
      productName: 'Coffee',
      categoryName: 'Drinks',
      hsnCode: '2202',
      gstRate: 5,
      cgstRate: 2.5,
      sgstRate: 2.5,
      quantity: 2.5,
      unitPrice: 32,
      taxAmount: 4,
    }

    expect(sumSalesGroupQuantity([{ item, line }, { item, line: { ...line, quantity: 1.5 } }])).toBe(4)
  })

  it('creates a searchable product label with SKU', () => {
    expect(productOptionValue({ sku: 'COFFEE-01', name: 'Coffee', productType: 'MENU_ITEM' }))
      .toBe('COFFEE-01 • Coffee • MENU_ITEM')
  })

  it('allows service items and tracked products in purchases, but excludes other non-stock items', () => {
    expect(isPurchasableProduct({ trackInventory: false, productType: 'SERVICE' })).toBe(true)
    expect(isPurchasableProduct({ trackInventory: true, productType: 'MERCHANDISE' })).toBe(true)
    expect(isPurchasableProduct({ trackInventory: false, productType: 'NON_STOCK' })).toBe(false)
    expect(isPurchasableProduct({ trackInventory: false, productType: 'MENU_ITEM' })).toBe(false)
  })

  it('matches inventory products by sku or product name', () => {
    expect(
      matchesProductSearch(
        { sku: 'COFFEE-01', name: 'Coffee', productType: 'MENU_ITEM' },
        'coffee',
      ),
    ).toBe(true)

    expect(
      matchesProductSearch(
        { sku: 'COFFEE-01', name: 'Coffee', productType: 'MENU_ITEM' },
        '01',
      ),
    ).toBe(true)

    expect(
      matchesProductSearch(
        { sku: 'COFFEE-01', name: 'Coffee', productType: 'MENU_ITEM' },
        'COFFEE-01',
      ),
    ).toBe(true)

    expect(
      matchesProductSearch(
        { sku: 'COFFEE-01', name: 'Coffee', productType: 'MENU_ITEM' },
        'latte',
      ),
    ).toBe(false)
  })

  it('summarizes sales totals including qty and tax', () => {
    const totals = summarizeSalesTotals([
      {
        orderId: '1',
        orderNumber: 'INV-100',
        total: 84,
        status: 'PAID',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        createdAt: '2026-09-25T10:00:00Z',
        lines: [
          {
            productId: 'p1',
            productName: 'Coffee',
            categoryName: 'Hot drinks',
            hsnCode: '9992',
            gstRate: 5,
            cgstRate: 2.5,
            sgstRate: 2.5,
            quantity: 2,
            unitPrice: 40,
            taxAmount: 4,
          },
        ],
      },
    ])

    expect(totals.orderCount).toBe(1)
    expect(totals.qty).toBe(2)
    expect(totals.grossSales).toBe(80)
    expect(totals.tax).toBe(4)
    expect(totals.netSales).toBe(76)
  })

  it('summarizes purchase totals including quantity and cost', () => {
    const totals = summarizePurchaseTotals([
      {
        id: 'p1',
        reference: 'PO-100',
        supplierId: 's1',
        supplierName: 'Acme',
        locationId: 'l1',
        total: 80,
        status: 'Received',
        createdAt: '2026-09-25T12:00:00Z',
        lines: [
          {
            productId: 'prod1',
            productName: 'Coffee',
            quantity: 10,
            unitCost: 8,
            batchNumber: undefined,
            expiryDate: undefined,
          },
        ],
      },
    ])

    expect(totals.receiptCount).toBe(1)
    expect(totals.qty).toBe(10)
    expect(totals.total).toBe(80)
  })

  it('calculates sales tax amounts from gross line total', () => {
    const amounts = calculateSalesLineAmounts({
      productId: 'p1',
      productName: 'Coffee',
      categoryName: 'Hot drinks',
      hsnCode: '9992',
      gstRate: 5,
      cgstRate: 2.5,
      sgstRate: 2.5,
      quantity: 2,
      unitPrice: 40,
      taxAmount: 4,
    })

    expect(amounts.grossAmount).toBe(80)
    expect(amounts.cgstAmount).toBe(2)
    expect(amounts.sgstAmount).toBe(2)
    expect(amounts.gstAmount).toBe(4)
    expect(amounts.netAmount).toBe(76)
  })
})

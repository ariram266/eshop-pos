import { describe, expect, it } from 'vitest'
import {
  calculateSalesLineAmounts,
  matchesProductSearch,
  summarizePurchaseTotals,
  summarizeSalesTotals,
} from './OperationsView'

describe('OperationsView helpers', () => {
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

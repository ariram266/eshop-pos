import { describe, expect, it, vi } from 'vitest'
import { buildReceiptHtml, createOrder } from './api'

describe('createOrder', () => {
  it('sends a unique idempotency key to the cloud API', async () => {
    const response = {
      id: 'order-1',
      orderNumber: '260920-1001',
      registerId: 'register-01',
      orderType: 'TAKEAWAY',
      paymentMethod: 'CASH',
      status: 'PAID',
      subtotal: 10,
      tax: 1,
      total: 11,
      createdAt: new Date().toISOString(),
      lines: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await createOrder({ registerId: 'register-01', orderType: 'TAKEAWAY', paymentMethod: 'CASH', lines: [{ productId: 'product-1', quantity: 1 }] })

    const request = fetchMock.mock.calls[0]
    expect(request[0]).toMatch(/\/api\/orders$/)
    expect(request[1].headers['Idempotency-Key']).toEqual(expect.any(String))
  })

  it('builds the thermal receipt layout with invoice totals', () => {
    const html = buildReceiptHtml({
      id: 'order-1',
      orderNumber: 'S113618',
      status: 'PAID',
      subtotal: 19.04,
      tax: 0.96,
      total: 20,
      paymentStatus: 'PAID',
      createdAt: '2026-09-24T16:16:00Z',
      lines: [{
        productId: 'product-1',
        name: 'Coffee/Tea/Milk 90ml',
        unitPrice: 20,
        quantity: 1,
        taxAmount: 1,
        gstRate: 5,
        cgstRate: 2.5,
        sgstRate: 2.5,
      }],
    }, { businessName: 'Counterpoint Foods', locationName: 'Head Office', gstNumber: '33ABCDE1234F1Z5' })

    expect(html).toContain('Counterpoint Foods')
    expect(html).toContain('Head Office')
    expect(html).toContain('GST# 33ABCDE1234F1Z5')
    expect(html).toContain('Invoice# S113618')
    expect(html).toContain('<span>20.00</span>\n        <span>1</span>\n        <span>1.00</span>\n        <span>20.00</span>')
    expect(html).toContain('Sub Total (Net)')
    expect(html).toContain('₹19.00')
    expect(html).toContain('₹0.50')
    expect(html).not.toContain('<span>GST</span>')
    expect(html).toContain('₹20.00')
    expect(html).toContain('TOTAL (Gross)')
    expect(html).toContain('Total Quantity: 1')
  })

  it('derives a missing receipt GST rate from the stored tax amount', () => {
    const html = buildReceiptHtml({
      id: 'order-2',
      orderNumber: '260926-6649',
      status: 'PAID',
      subtotal: 3.2,
      tax: 0.3,
      total: 3.5,
      paymentStatus: 'PAID',
      createdAt: '2026-09-25T22:48:00Z',
      lines: [{
        productId: 'product-2',
        name: 'Coffee',
        unitPrice: 3.5,
        quantity: 1,
        taxAmount: 0.3,
      }],
    })

    expect(html).toContain('<span>3.50</span>\n        <span>1</span>\n        <span>0.30</span>\n        <span>3.50</span>')
    expect(html).toContain('₹3.20')
    expect(html).toContain('₹3.50')
  })
})

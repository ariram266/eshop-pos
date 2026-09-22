import { describe, expect, it, vi } from 'vitest'
import { createOrder } from './api'

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
})

const { registerShop, createProduct, auth, app, request } = require('./helpers');

const stockOf = async (token, id) => {
  const res = await request(app).get(`/api/products/${id}`).set(auth(token)).expect(200);
  return res.body.data.stockQuantity;
};

describe('POS checkout', () => {
  let shop;
  let product;

  beforeEach(async () => {
    shop = await registerShop();
    product = await createProduct(shop.token, { stockQuantity: 40, sellingPrice: 1650, costPrice: 1450 });
  });

  it('records a sale and decrements stock', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 3 }] })
      .expect(201);

    expect(res.body.data.totalAmount).toBe(4950);
    expect(await stockOf(shop.token, product._id)).toBe(37);
  });

  it('applies a discount to the total', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 2 }], discount: 300 })
      .expect(201);

    expect(res.body.data.subtotal).toBe(3300);
    expect(res.body.data.totalAmount).toBe(3000);
  });

  it('snapshots prices onto the sale so later price edits do not rewrite history', async () => {
    const sale = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 1 }] })
      .expect(201);

    await request(app)
      .put(`/api/products/${product._id}`)
      .set(auth(shop.token))
      .send({ sellingPrice: 9999 })
      .expect(200);

    const res = await request(app).get(`/api/sales/${sale.body.data._id}`).set(auth(shop.token)).expect(200);
    expect(res.body.data.items[0].unitPrice).toBe(1650);
  });

  it('rejects overselling', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 999 }] })
      .expect(400);

    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  it('rolls the whole transaction back when one line oversells', async () => {
    const ok = await createProduct(shop.token, { stockQuantity: 50, sku: `OK-${Date.now()}` });

    await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({
        items: [
          { productId: ok._id, quantity: 2 }, // would succeed alone
          { productId: product._id, quantity: 999 }, // fails
        ],
      })
      .expect(400);

    // Neither product may have moved - this is the guarantee transactions buy us
    expect(await stockOf(shop.token, ok._id)).toBe(50);
    expect(await stockOf(shop.token, product._id)).toBe(40);
  });

  it('rejects an empty cart', async () => {
    await request(app).post('/api/sales').set(auth(shop.token)).send({ items: [] }).expect(400);
  });

  it('requires a customer for credit (khata) sales', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 1 }], paymentMethod: 'credit' })
      .expect(400);

    expect(res.body.message).toMatch(/customer is required/i);
  });

  it('adds unpaid credit to the customer khata balance', async () => {
    const customer = await request(app)
      .post('/api/customers')
      .set(auth(shop.token))
      .send({ name: 'Ahmed', phone: '03001112222' })
      .expect(201);

    await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({
        items: [{ productId: product._id, quantity: 1 }],
        paymentMethod: 'credit',
        customerId: customer.body.data._id,
        amountPaid: 650, // 1650 owed, 650 paid
      })
      .expect(201);

    const res = await request(app)
      .get(`/api/customers/${customer.body.data._id}`)
      .set(auth(shop.token))
      .expect(200);

    expect(res.body.data.creditBalance).toBe(1000);
  });
});

describe('Offline sale idempotency', () => {
  let shop;
  let product;

  beforeEach(async () => {
    shop = await registerShop();
    product = await createProduct(shop.token, { stockQuantity: 40 });
  });

  it('does not double-record a sale retried with the same clientRef', async () => {
    const clientRef = 'offline-ref-abc-123';
    const payload = { items: [{ productId: product._id, quantity: 5 }], clientRef, syncedFromOffline: true };

    const first = await request(app).post('/api/sales').set(auth(shop.token)).send(payload).expect(201);
    const retry = await request(app).post('/api/sales').set(auth(shop.token)).send(payload).expect(200);

    expect(retry.body.duplicate).toBe(true);
    expect(retry.body.data.receiptNumber).toBe(first.body.data.receiptNumber);
    // Stock decremented exactly once
    expect(await stockOf(shop.token, product._id)).toBe(35);
  });

  it('marks synced offline sales so they can be told apart', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({
        items: [{ productId: product._id, quantity: 1 }],
        clientRef: 'offline-ref-xyz',
        syncedFromOffline: true,
      })
      .expect(201);

    expect(res.body.data.syncedFromOffline).toBe(true);
  });

  it('allows many ordinary sales that carry no clientRef', async () => {
    // Regression guard: a compound *sparse* unique index indexes missing
    // clientRefs as null, so the second such sale would collide. The index must
    // be partial. This test is the tripwire for that regression.
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/sales')
        .set(auth(shop.token))
        .send({ items: [{ productId: product._id, quantity: 1 }] })
        .expect(201);
    }

    expect(await stockOf(shop.token, product._id)).toBe(37);
  });
});

describe('Refunds', () => {
  let shop;
  let product;

  beforeEach(async () => {
    shop = await registerShop();
    product = await createProduct(shop.token, { stockQuantity: 40 });
  });

  it('restores stock and marks the sale refunded', async () => {
    const sale = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 4 }] })
      .expect(201);

    expect(await stockOf(shop.token, product._id)).toBe(36);

    const res = await request(app)
      .patch(`/api/sales/${sale.body.data._id}/refund`)
      .set(auth(shop.token))
      .expect(200);

    expect(res.body.data.status).toBe('refunded');
    expect(await stockOf(shop.token, product._id)).toBe(40);
  });

  it('refuses to refund the same sale twice', async () => {
    const sale = await request(app)
      .post('/api/sales')
      .set(auth(shop.token))
      .send({ items: [{ productId: product._id, quantity: 2 }] })
      .expect(201);

    await request(app).patch(`/api/sales/${sale.body.data._id}/refund`).set(auth(shop.token)).expect(200);
    await request(app).patch(`/api/sales/${sale.body.data._id}/refund`).set(auth(shop.token)).expect(400);

    // Stock restored once, not twice
    expect(await stockOf(shop.token, product._id)).toBe(40);
  });
});

describe('Purchase receiving', () => {
  let shop;
  let product;
  let supplier;

  beforeEach(async () => {
    shop = await registerShop();
    product = await createProduct(shop.token, { stockQuantity: 10, costPrice: 100 });
    const res = await request(app)
      .post('/api/suppliers')
      .set(auth(shop.token))
      .send({ name: 'Al-Karam Traders', phone: '03001234567' })
      .expect(201);
    supplier = res.body.data;
  });

  const makePO = () =>
    request(app)
      .post('/api/purchases')
      .set(auth(shop.token))
      .send({
        supplierId: supplier._id,
        items: [{ productId: product._id, quantity: 50, costPrice: 100 }],
        amountPaid: 0,
      })
      .expect(201);

  it('does not add stock until the order is received', async () => {
    await makePO();
    expect(await stockOf(shop.token, product._id)).toBe(10);
  });

  it('adds stock and increases the supplier balance on receive', async () => {
    const po = await makePO();

    await request(app)
      .patch(`/api/purchases/${po.body.data._id}/receive`)
      .set(auth(shop.token))
      .expect(200);

    expect(await stockOf(shop.token, product._id)).toBe(60);

    const suppliers = await request(app).get('/api/suppliers').set(auth(shop.token)).expect(200);
    expect(suppliers.body.data[0].balance).toBe(5000);
  });

  it('refuses to receive the same order twice', async () => {
    const po = await makePO();
    await request(app).patch(`/api/purchases/${po.body.data._id}/receive`).set(auth(shop.token)).expect(200);
    await request(app).patch(`/api/purchases/${po.body.data._id}/receive`).set(auth(shop.token)).expect(400);

    expect(await stockOf(shop.token, product._id)).toBe(60);
  });

  it('refuses to cancel an order that was already received', async () => {
    const po = await makePO();
    await request(app).patch(`/api/purchases/${po.body.data._id}/receive`).set(auth(shop.token)).expect(200);
    await request(app).patch(`/api/purchases/${po.body.data._id}/cancel`).set(auth(shop.token)).expect(400);
  });
});

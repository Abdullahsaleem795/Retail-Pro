const { registerShop, createProduct, auth, app, request } = require('./helpers');

/**
 * Tenant isolation is the single most important property of this system: a
 * leak here means one shopkeeper can read or alter a competitor's books.
 */
describe('Multi-tenant isolation', () => {
  let shopA;
  let shopB;
  let productA;

  beforeEach(async () => {
    shopA = await registerShop({ shopName: 'Shop A' });
    shopB = await registerShop({ shopName: 'Shop B' });
    productA = await createProduct(shopA.token);
  });

  it('gives each shop a distinct shopId', () => {
    expect(shopA.shopId).not.toBe(shopB.shopId);
  });

  it('does not list another shop\'s products', async () => {
    const res = await request(app).get('/api/products').set(auth(shopB.token)).expect(200);
    expect(res.body.total).toBe(0);
  });

  it('returns 404 (not 403) when reading another shop\'s product', async () => {
    // 404 rather than 403 matters: 403 would confirm the record exists.
    await request(app).get(`/api/products/${productA._id}`).set(auth(shopB.token)).expect(404);
  });

  it('refuses to update another shop\'s product', async () => {
    await request(app)
      .put(`/api/products/${productA._id}`)
      .set(auth(shopB.token))
      .send({ sellingPrice: 1 })
      .expect(404);

    // and the original is untouched
    const check = await request(app).get(`/api/products/${productA._id}`).set(auth(shopA.token)).expect(200);
    expect(check.body.data.sellingPrice).toBe(1650);
  });

  it('refuses to delete another shop\'s product', async () => {
    await request(app).delete(`/api/products/${productA._id}`).set(auth(shopB.token)).expect(404);
    await request(app).get(`/api/products/${productA._id}`).set(auth(shopA.token)).expect(200);
  });

  it('refuses to sell another shop\'s product', async () => {
    await request(app)
      .post('/api/sales')
      .set(auth(shopB.token))
      .send({ items: [{ productId: productA._id, quantity: 1 }] })
      .expect(404);
  });

  it('cannot reassign a product to another shop via the request body', async () => {
    await request(app)
      .put(`/api/products/${productA._id}`)
      .set(auth(shopA.token))
      .send({ shopId: shopB.shopId, name: 'Renamed' })
      .expect(200);

    // Still invisible to shop B - the body shopId was stripped
    await request(app).get(`/api/products/${productA._id}`).set(auth(shopB.token)).expect(404);
  });

  it('scopes dashboard reports per shop', async () => {
    await request(app)
      .post('/api/sales')
      .set(auth(shopA.token))
      .send({ items: [{ productId: productA._id, quantity: 2 }] })
      .expect(201);

    const a = await request(app).get('/api/reports/dashboard').set(auth(shopA.token)).expect(200);
    const b = await request(app).get('/api/reports/dashboard').set(auth(shopB.token)).expect(200);

    expect(a.body.data.todaySales).toBeGreaterThan(0);
    expect(b.body.data.todaySales).toBe(0);
    expect(b.body.data.productsInStock).toBe(0);
  });

  it('scopes customers per shop', async () => {
    await request(app)
      .post('/api/customers')
      .set(auth(shopA.token))
      .send({ name: 'Ahmed Raza', phone: '03011112222' })
      .expect(201);

    const res = await request(app).get('/api/customers').set(auth(shopB.token)).expect(200);
    expect(res.body.count).toBe(0);
  });
});

const { registerShop, addStaff, createProduct, auth, app, request } = require('./helpers');

describe('Roles and permissions', () => {
  let shop;
  let product;

  beforeEach(async () => {
    shop = await registerShop();
    product = await createProduct(shop.token);
  });

  it('lets a cashier ring up a sale (their actual job)', async () => {
    const cashier = await addStaff(shop.token, { role: 'cashier' });

    await request(app)
      .post('/api/sales')
      .set(auth(cashier.token))
      .send({ items: [{ productId: product._id, quantity: 1 }] })
      .expect(201);
  });

  it('blocks a cashier from deleting products', async () => {
    const cashier = await addStaff(shop.token, { role: 'cashier' });
    await request(app).delete(`/api/products/${product._id}`).set(auth(cashier.token)).expect(403);
  });

  it('blocks a cashier from refunding', async () => {
    const cashier = await addStaff(shop.token, { role: 'cashier' });
    const sale = await request(app)
      .post('/api/sales')
      .set(auth(cashier.token))
      .send({ items: [{ productId: product._id, quantity: 1 }] })
      .expect(201);

    await request(app).patch(`/api/sales/${sale.body.data._id}/refund`).set(auth(cashier.token)).expect(403);
  });

  it('blocks a cashier from changing shop settings', async () => {
    const cashier = await addStaff(shop.token, { role: 'cashier' });
    await request(app).put('/api/shop').set(auth(cashier.token)).send({ name: 'Hacked' }).expect(403);
  });

  it('blocks a cashier from managing staff', async () => {
    const cashier = await addStaff(shop.token, { role: 'cashier' });
    await request(app).get('/api/shop/users').set(auth(cashier.token)).expect(403);
  });

  it('lets a manager manage products', async () => {
    const manager = await addStaff(shop.token, { role: 'manager' });
    await request(app)
      .put(`/api/products/${product._id}`)
      .set(auth(manager.token))
      .send({ sellingPrice: 1700 })
      .expect(200);
  });

  it('still blocks a manager from managing staff', async () => {
    const manager = await addStaff(shop.token, { role: 'manager' });
    await request(app).get('/api/shop/users').set(auth(manager.token)).expect(403);
  });

  it('honours an individual grant on top of the base role', async () => {
    // A cashier normally cannot record expenses; granting the permission
    // should work without promoting them to manager.
    const cashier = await addStaff(shop.token, {
      role: 'cashier',
      permissions: ['expense:manage'],
    });

    const expense = await request(app)
      .post('/api/expenses')
      .set(auth(cashier.token))
      .send({ title: 'Chai for staff', amount: 200, category: 'other' })
      .expect(201);

    await request(app)
      .delete(`/api/expenses/${expense.body.data._id}`)
      .set(auth(cashier.token))
      .expect(200);

    // ...but the grant does not leak into unrelated abilities
    await request(app).delete(`/api/products/${product._id}`).set(auth(cashier.token)).expect(403);
  });

  it('silently drops attempts to self-grant staff:manage', async () => {
    // staff:manage is deliberately not grantable - otherwise an owner could be
    // tricked into handing over full control of the shop.
    const cashier = await addStaff(shop.token, {
      role: 'cashier',
      permissions: ['staff:manage', 'shop:settings'],
    });

    await request(app).get('/api/shop/users').set(auth(cashier.token)).expect(403);
    await request(app).put('/api/shop').set(auth(cashier.token)).send({ name: 'X' }).expect(403);
  });

  it('refuses to create a second owner', async () => {
    await request(app)
      .post('/api/shop/users')
      .set(auth(shop.token))
      .send({ name: 'Sneaky', email: 'sneaky@test.pk', password: 'test1234', role: 'owner' })
      .expect(400);
  });

  it('refuses to delete the owner account', async () => {
    await request(app).delete(`/api/shop/users/${shop.userId}`).set(auth(shop.token)).expect(403);
  });

  it('denies access to a suspended user', async () => {
    const cashier = await addStaff(shop.token, { role: 'cashier' });

    const users = await request(app).get('/api/shop/users').set(auth(shop.token)).expect(200);
    const staffRecord = users.body.data.find((u) => u.role === 'cashier');

    await request(app)
      .put(`/api/shop/users/${staffRecord._id}`)
      .set(auth(shop.token))
      .send({ isActive: false })
      .expect(200);

    await request(app).get('/api/products').set(auth(cashier.token)).expect(401);
  });
});

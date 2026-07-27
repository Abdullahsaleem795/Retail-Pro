const request = require('supertest');
const app = require('../src/app');

/** Registers a shop + owner and returns { token, shopId, userId, shop }. */
const registerShop = async (overrides = {}) => {
  const payload = {
    shopName: 'Test Kiryana Store',
    businessType: 'kiryana',
    ownerName: 'Test Owner',
    phone: '03001234567',
    email: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.pk`,
    password: 'test1234',
    city: 'Lahore',
    ...overrides,
  };

  const res = await request(app).post('/api/auth/register').send(payload).expect(201);

  return {
    token: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    shopId: res.body.shop.id,
    userId: res.body.user.id,
    email: payload.email,
    password: payload.password,
    body: res.body,
  };
};

/** Creates a staff user under an existing shop and returns their access token. */
const addStaff = async (ownerToken, { role = 'cashier', permissions = [] } = {}) => {
  const email = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.pk`;
  const password = 'staff1234';

  await request(app)
    .post('/api/shop/users')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Test Staff', email, password, role, permissions })
    .expect(201);

  const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return { token: login.body.accessToken, email, password };
};

const createProduct = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Basmati Rice 5kg',
      sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      costPrice: 1450,
      sellingPrice: 1650,
      stockQuantity: 40,
      lowStockThreshold: 10,
      ...overrides,
    })
    .expect(201);
  return res.body.data;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { registerShop, addStaff, createProduct, auth, app, request };

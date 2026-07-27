const { registerShop, auth, app, request } = require('./helpers');

describe('Authentication', () => {
  it('registers a shop with an owner account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        shopName: 'Al-Madina Store',
        ownerName: 'Abdullah',
        phone: '03001234567',
        email: 'newowner@test.pk',
        password: 'test1234',
      })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.role).toBe('owner');
    expect(res.body.shop.name).toBe('Al-Madina Store');
  });

  it('rejects registration with a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        shopName: 'Bad Store',
        ownerName: 'X',
        phone: '0300',
        email: 'bad@test.pk',
        password: '123',
      })
      .expect(400);

    expect(res.body.message).toMatch(/at least 6 characters/i);
  });

  it('rejects registration with an invalid email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ shopName: 'S', ownerName: 'X', phone: '0300', email: 'not-an-email', password: 'test1234' })
      .expect(400);
  });

  it('never returns the password hash', async () => {
    const shop = await registerShop();
    const res = await request(app).get('/api/auth/me').set(auth(shop.token)).expect(200);
    expect(res.body.user.password).toBeUndefined();
  });

  it('logs in with correct credentials', async () => {
    const shop = await registerShop();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: shop.email, password: shop.password })
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.permissions).toContain('product:manage');
  });

  it('rejects a wrong password', async () => {
    const shop = await registerShop();
    await request(app)
      .post('/api/auth/login')
      .send({ email: shop.email, password: 'wrongpassword' })
      .expect(401);
  });

  it('rejects requests with no token', async () => {
    await request(app).get('/api/products').expect(401);
  });

  it('rejects a malformed token', async () => {
    await request(app).get('/api/products').set(auth('not.a.jwt')).expect(401);
  });

  it('exchanges a refresh token for a new access token', async () => {
    const shop = await registerShop();
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: shop.refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
  });

  it('changes a password only with the correct current password', async () => {
    const shop = await registerShop();

    await request(app)
      .put('/api/auth/password')
      .set(auth(shop.token))
      .send({ currentPassword: 'wrong', newPassword: 'newpass123' })
      .expect(401);

    await request(app)
      .put('/api/auth/password')
      .set(auth(shop.token))
      .send({ currentPassword: shop.password, newPassword: 'newpass123' })
      .expect(200);

    await request(app).post('/api/auth/login').send({ email: shop.email, password: 'newpass123' }).expect(200);
  });
});

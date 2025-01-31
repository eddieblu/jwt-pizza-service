const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

// NOTES: before any of the tests runs this code will run. Not before each one, only once per run of tests. 
beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('register', async () => {
  const user = { name: 'pizza diner', email: '', password: 'a' };
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(user);
  expect(registerRes.status).toBe(200);

  expectValidJwt(registerRes.body.token);
  const expectedUser = { ...user, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(registerRes.body.user).toMatchObject(expectedUser);
});

test('register without password', async () => {
  const user = { name: 'pizza diner', email: '', password: '' };
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(user);
  expect(registerRes.status).toBe(400);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
  const user = { name: 'pizza diner', email: '', password: 'a' };
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(user);
  expect(registerRes.status).toBe(200);

  const loginRes = await request(app).put('/api/auth').send(user);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const token = loginRes.body.token;
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${token}`);

  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
});

test('change user email', async () => {
  const user = { name: 'pizza diner', email: '', password: 'a' };
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(user);

  expect(registerRes.status).toBe(200);
  expect(registerRes.body.user).toHaveProperty('id');
  const userId = registerRes.body.user.id;

  const loginRes = await request(app).put('/api/auth').send(user);
  expect(loginRes.status).toBe(200);
  const token = loginRes.body.token;
  expectValidJwt(token);

  const newEmail = `updated_${Math.random().toString(36).substr(2, 8)}@example.com`;
  await request(app).put(`/api/auth/${userId}`).set('Authorization', `Bearer ${token}`).send({ email: newEmail });

  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${token}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');

  const userWithNewEmail = { name: 'pizza diner', email: newEmail, password: 'a' };
  const newLoginRes = await request(app).put('/api/auth').send(userWithNewEmail);
  expect(newLoginRes.status).toBe(200);
  expectValidJwt(newLoginRes.body.token);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}
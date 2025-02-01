const request = require('supertest');
const app = require('../service');

const { Role, DB } = require('../database/database.js');

// may be unnecessary for line coverage ? 
test('return list of franchises', async () => {
    const adminUser = createAdminUser()
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
});

test('create franchise', async () => {
    const adminUser = await createAdminUser();
    const adminEmail = adminUser.email;
    
    const newFranchiseName = randomName();
    const newFranchise = { name: newFranchiseName, admins: [{ email: adminEmail }] };
    const newFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminUser.token}`).send(newFranchise);

    expect(newFranchiseRes.status).toBe(200);
    expect(newFranchiseRes.body).toHaveProperty('id');
    expect(newFranchiseRes.body).toHaveProperty('name', newFranchiseName);
});

async function createFranchise(adminUser) {
    const adminEmail = adminUser.email;
    
    const newFranchiseName = randomName();
    const newFranchise = { name: newFranchiseName, admins: [{ email: adminEmail }] };
    const newFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminUser.token}`).send(newFranchise);

    return newFranchiseRes.body;
}

test('deleteFranchise', async () => {
    const adminUser = await createAdminUser();
    const authToken = adminUser.token;
    const newFranchise = await createFranchise(adminUser);

    const deleteFranchiseRes = await request(app).delete(`/api/franchise/${newFranchise.id}`).set('Authorization', `Bearer ${authToken}`);
    
});

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  user.password = 'toomanysecrets';

  const loginRes = await request(app).put('/api/auth').send(user);
  const authToken = loginRes.body.token;

  return { ...user, password: 'toomanysecrets', token: authToken };
}
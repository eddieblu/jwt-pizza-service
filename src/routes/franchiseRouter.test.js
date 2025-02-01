const request = require('supertest');
const app = require('../service');

const { Role, DB } = require('../database/database.js');

test('return list of franchises', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
});

test('create franchise', async () => {
    const adminUser = await createAdminUser();

    const newFranchiseName = randomName();
    const newFranchise = { name: newFranchiseName, admins: [{ email: adminUser.email }] };
    
    const newFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminUser.token}`).send(newFranchise);

    expect(newFranchiseRes.status).toBe(200);
    expect(newFranchiseRes.body).toHaveProperty('id');
    expect(newFranchiseRes.body).toHaveProperty('name', newFranchiseName);
});

test('delete franchise', async () => {
    const adminUser = await createAdminUser();
    const newFranchise = await createFranchise(adminUser);

    const deleteFranchiseRes = await request(app).delete(`/api/franchise/${newFranchise.id}`).set('Authorization', `Bearer ${adminUser.token}`);
    expect(deleteFranchiseRes.status).toBe(200);
    expect(deleteFranchiseRes.body.message).toBe('franchise deleted');
});

test('create store', async () => {
    const adminUser = await createAdminUser();
    const newFranchise = await createFranchise(adminUser);

    const newStore = { "franchiseId": newFranchise.id, "name": randomName() }

    const newStoreRes = await request(app).post(`/api/franchise/${newFranchise.id}/store`).set('Authorization', `Bearer ${adminUser.token}`).send(newStore);
    expect(newStoreRes.status).toBe(200);
    expect(newStoreRes.body.name).toBe(newStore.name);
});

test('delete store', async () => {
    const adminUser = await createAdminUser();
    const newFranchise = await createFranchise(adminUser);

    const newStore = { "franchiseId": newFranchise.id, "name": randomName() }
    const newStoreRes = await request(app).post(`/api/franchise/${newFranchise.id}/store`).set('Authorization', `Bearer ${adminUser.token}`).send(newStore);

    const deleteStoreRes = await request(app).delete(`/api/franchise/${newStoreRes.body.id}/store/:storeId`).set('Authorization', `Bearer ${adminUser.token}`);
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.body.message).toBe('store deleted');    
})



// HELPER FUNCTIONS BELOW

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

async function createFranchise(adminUser) {
    const adminEmail = adminUser.email;

    const newFranchiseName = randomName();
    const newFranchise = { name: newFranchiseName, admins: [{ email: adminEmail }] };
    const newFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminUser.token}`).send(newFranchise);

    return newFranchiseRes.body;
}

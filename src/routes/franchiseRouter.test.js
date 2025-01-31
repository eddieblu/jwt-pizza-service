const request = require('supertest');
const app = require('../service');

let testAdminAuthToken;

beforeAll(async () => {
    // login as admin
    const loginRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
    expect(loginRes.status).toBe(200);
    testAdminAuthToken = loginRes.body.token;
    expectValidJwt(testAdminAuthToken);
});

// may be unnecessary for line coverage ? 
test('return list of franchises', async () => {
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
});

test('create franchise', createFranchise);

async function createFranchise() {
    const newFranchiseName = randomName();
    const newFranchise = { name: newFranchiseName, admins: [{ email: 'a@jwt.com' }] };
    const newFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testAdminAuthToken}`).send(newFranchise);

    expect(newFranchiseRes.status).toBe(200);
    expect(newFranchiseRes.body).toHaveProperty('id');
    expect(newFranchiseRes.body).toHaveProperty('name', newFranchiseName);
}

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}
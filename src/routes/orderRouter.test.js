const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

test('add menu item', async () => {
    const adminUser = await createAdminUser();
    const newMenuItemName = randomName();
    const newMenuItem = { title: newMenuItemName, description: "No topping, no sauce, just carbs", image: "pizza9.png", price: 0.0001 };

    const addMenuItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminUser.token}`).send(newMenuItem);
    expect(addMenuItemRes.status).toBe(200);
    expect(addMenuItemRes.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: newMenuItemName })]));
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

async function createDinerUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Diner }] };
    user.name = randomName();
    user.email = user.name + '@diner.com';

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
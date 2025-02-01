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

test('create order', async () => {
    // create franchise and store 
    const adminUser = await createAdminUser();
    const newFranchise = await createFranchise(adminUser);
    const newStore = { "franchiseId": newFranchise.id, "name": randomName() }
    const newStoreRes = await request(app).post(`/api/franchise/${newFranchise.id}/store`).set('Authorization', `Bearer ${adminUser.token}`).send(newStore);
    expect(newStoreRes.status).toBe(200);

    //create menu item 
    const newMenuItemName = randomName();
    const newMenuItem = { title: newMenuItemName, description: "No topping, no sauce, just carbs", image: "pizza9.png", price: 0.0001 };
    const addMenuItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminUser.token}`).send(newMenuItem);
    expect(addMenuItemRes.status).toBe(200);

    // get new menu item id
    const addedItem = addMenuItemRes.body.find(item => item.title === newMenuItemName);
    newMenuItem.id = addedItem.id;

    // create diner
    const dinerUser = await createDinerUser();

    // create order 
    const newOrder = { "franchiseId": newFranchise.id, "storeId": newStoreRes.body.id, "items": [{ "menuId": newMenuItem.id, "description": newMenuItem.description, "price": newMenuItem.price }] };
    const newOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerUser.token}`).send(newOrder);
    expect(newOrderRes.status).toBe(200);

    // check to see that newOrder is listed in diner's orders
    const orderListRes = await request(app).get('/api/order').set('Authorization', `Bearer ${dinerUser.token}`);
    expect(orderListRes.status).toBe(200);

    const matchingOrder = orderListRes.body.orders.find((order) => order.id === newOrderRes.body.order.id);
    expect(matchingOrder).toBeDefined();
    expect(matchingOrder.items).toEqual(expect.arrayContaining([expect.objectContaining({ menuId: newMenuItem.id, description: newMenuItem.description, price: newMenuItem.price, }),]));
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
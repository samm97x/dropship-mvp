import fs from 'fs/promises';
import path from 'path';

const dataDirectory = path.resolve('./data');
const ordersFile = path.join(dataDirectory, 'orders.json');

async function ensureStore() {
  try {
    await fs.access(dataDirectory);
  } catch {
    await fs.mkdir(dataDirectory, { recursive: true });
  }

  try {
    await fs.access(ordersFile);
  } catch {
    await fs.writeFile(ordersFile, JSON.stringify({ orders: [] }, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureStore();
  const content = await fs.readFile(ordersFile, 'utf8');
  return JSON.parse(content);
}

async function writeStore(data) {
  await ensureStore();
  await fs.writeFile(ordersFile, JSON.stringify(data, null, 2), 'utf8');
}

export async function saveOrder(order) {
  const store = await readStore();
  store.orders.push(order);
  await writeStore(store);
  return order;
}

export async function getOrders() {
  const store = await readStore();
  return store.orders || [];
}

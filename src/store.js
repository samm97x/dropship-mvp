import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';
import config from './config.js';

const dataDirectory = path.resolve('./data');
const ordersFile = path.join(dataDirectory, 'orders.json');
const usePostgres = Boolean(config.database.url);

let pool;

function getPool() {
  if (!pool) {
    const shouldUseSsl = process.env.PGSSLMODE !== 'disable';
    pool = new Pool({
      connectionString: config.database.url,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
    });
  }

  return pool;
}

async function ensurePostgresStore() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload JSONB NOT NULL
    );
  `);
}

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

export async function initStore() {
  if (usePostgres) {
    await ensurePostgresStore();
    return;
  }

  await ensureStore();
}

export async function saveOrder(order) {
  if (usePostgres) {
    const db = getPool();
    const orderId = String(order.orderId || order.id || 'unknown');
    const createdAt = order.createdAt || new Date().toISOString();
    const payload = { ...order, orderId: Number(orderId) || orderId, createdAt };

    await db.query(
      `
      INSERT INTO orders (order_id, created_at, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (order_id)
      DO UPDATE SET
        created_at = EXCLUDED.created_at,
        payload = EXCLUDED.payload
      `,
      [orderId, createdAt, JSON.stringify(payload)]
    );

    return payload;
  }

  const store = await readStore();
  store.orders.push(order);
  await writeStore(store);
  return order;
}

export async function getOrders() {
  if (usePostgres) {
    const db = getPool();
    const result = await db.query('SELECT payload FROM orders ORDER BY created_at ASC');
    return result.rows.map((row) => row.payload);
  }

  const store = await readStore();
  return store.orders || [];
}

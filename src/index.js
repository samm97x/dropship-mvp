import express from 'express';
import path from 'path';
import config from './config.js';
import { handleWooOrderWebhook } from './woocommerce.js';
import { startProductSync, startOrderSync } from './automation.js';
import { getOrders } from './store.js';
import { processOrder } from './orderProcessor.js';

const app = express();

// Webhook route MUST come before express.json() middleware
// so req.body is the raw Buffer, not parsed JSON
app.post('/webhook/woocommerce', express.raw({ type: '*/*' }), handleWooOrderWebhook);

app.use(express.json());
app.use(express.static(path.resolve('./public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/test-order', (req, res) => {
  const fakeOrder = {
    id: Date.now(),
    status: 'pending',
    billing: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
    line_items: [{ sku: 'TEST123', quantity: 1, name: 'Test Product', price: '10.00' }]
  };
  processOrder(fakeOrder).then(result => res.json(result)).catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await getOrders();
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.resolve('./public/index.html'));
});

// webhook route already registered above before json middleware

app.listen(config.port, () => {
  console.log(`Dropship MVP backend listening on http://localhost:${config.port}`);
  startProductSync();
  startOrderSync();
});

// Global error handler — must be last
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

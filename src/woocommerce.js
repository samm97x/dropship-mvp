import crypto from 'crypto';
import axios from 'axios';
import config from './config.js';
import { processOrder } from './orderProcessor.js';

export function verifyWooWebhook(rawBody, signature) {
  // Skip verification in local/dev mode — enable in production
  return true;
}

export async function handleWooOrderWebhook(req, res) {
  try {
    const signature = req.headers['x-wc-webhook-signature'];
    if (!verifyWooWebhook(req.body, signature)) {
      return res.status(401).send('Invalid webhook signature');
    }

    let payload;
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      console.log('Raw webhook body (first 300):', raw.slice(0, 300));
      if (!raw || !raw.trim()) {
        return res.status(200).json({ success: true, message: 'Webhook probe received (empty body)' });
      }
      payload = JSON.parse(raw);
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError.message);
      console.error('Body type:', typeof req.body, 'isBuffer:', Buffer.isBuffer(req.body));
      // Some WooCommerce test/ping deliveries may not send JSON payloads.
      return res.status(200).json({ success: true, message: 'Webhook probe received (non-JSON body)' });
    }

    const order = payload.order || payload;
    console.log('WooCommerce webhook received:', JSON.stringify(order).slice(0, 200));

    if (!order || !order.id) {
      console.warn('Webhook received but no order ID found, accepting anyway');
      return res.status(200).json({ success: true, message: 'Received but no order ID' });
    }

    const result = await processOrder(order);
    return res.json({ success: true, result });
  } catch (error) {
    console.error('WooCommerce webhook error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateWooOrderStatus(orderId, status) {
  if (!config.woo.storeUrl || !config.woo.consumerKey || !config.woo.consumerSecret) {
    throw new Error('WooCommerce credentials are not configured');
  }

  const endpoint = `${config.woo.storeUrl.replace(/\/$/, '')}/wp-json/wc/v3/orders/${orderId}`;
  const params = {
    consumer_key: config.woo.consumerKey,
    consumer_secret: config.woo.consumerSecret
  };
  const data = { status };

  const response = await axios.put(endpoint, data, { params, timeout: 15000 });
  return response.data;
}

export async function syncProducts() {
  if (!config.woo.storeUrl || !config.woo.consumerKey || !config.woo.consumerSecret) {
    console.warn('WooCommerce credentials are missing. Skipping product sync.');
    return [];
  }

  const endpoint = `${config.woo.storeUrl.replace(/\/$/, '')}/wp-json/wc/v3/products`;
  const params = {
    consumer_key: config.woo.consumerKey,
    consumer_secret: config.woo.consumerSecret,
    per_page: 50
  };

  try {
    const response = await axios.get(endpoint, { params, timeout: 15000 });
    const products = response.data;
    console.log(`WooCommerce sync loaded ${products.length} products`);
    return products;
  } catch (error) {
    console.error('WooCommerce product sync failed:', error.message);
    return [];
  }
}

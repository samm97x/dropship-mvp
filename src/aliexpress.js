import axios from 'axios';
import config from './config.js';

function hasAliCredentials() {
  return config.aliexpress.baseUrl && config.aliexpress.apiKey;
}

export async function aliExpressApiRequest(path, method = 'GET', data = null) {
  if (!hasAliCredentials()) {
    throw new Error('AliExpress API credentials are not configured.');
  }

  const url = `${config.aliexpress.baseUrl.replace(/\/$/, '')}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': config.aliexpress.apiKey
  };

  return axios({ url, method, data, headers, timeout: 20000 });
}

export async function createAliExpressOrder(order) {
  if (!hasAliCredentials()) {
    console.warn('AliExpress credentials missing. Using placeholder fulfillment.');
    return {
      success: false,
      mode: 'stub',
      supplierOrderId: `stub-${order.id || Date.now()}`,
      trackingNumber: `TRACK-${Date.now()}`
    };
  }

  const payload = {
    shop_id: config.aliexpress.shopId,
    order_reference: order.id,
    shipping_address: order.shipping,
    items: (order.line_items || []).map((item) => ({
      sku: item.sku || item.product_id,
      quantity: item.quantity,
      title: item.name,
      price: item.price
    }))
  };

  const response = await aliExpressApiRequest('/orders/create', 'POST', payload);
  return response.data;
}

export async function syncAliExpressInventory() {
  if (!hasAliCredentials()) {
    console.warn('AliExpress credentials missing. Skipping inventory sync.');
    return [];
  }

  try {
    const response = await aliExpressApiRequest('/inventory/list');
    console.log(`AliExpress inventory sync returned ${response.data.length || 0} items`);
    return response.data;
  } catch (error) {
    console.error('AliExpress inventory sync failed:', error.message);
    return [];
  }
}

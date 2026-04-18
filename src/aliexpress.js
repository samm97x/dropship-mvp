import axios from 'axios';
import config from './config.js';

function isPlaceholder(value) {
  if (!value) return true;
  const normalized = String(value).toLowerCase();
  return (
    normalized.includes('your_api_key') ||
    normalized.includes('your_api_secret') ||
    normalized.includes('your_shop_id')
  );
}

function hasAliCredentials() {
  return Boolean(
    config.aliexpress.baseUrl &&
      config.aliexpress.apiKey &&
      config.aliexpress.apiSecret &&
      config.aliexpress.shopId &&
      !isPlaceholder(config.aliexpress.apiKey) &&
      !isPlaceholder(config.aliexpress.apiSecret) &&
      !isPlaceholder(config.aliexpress.shopId)
  );
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
  if (config.fulfillment.mode === 'dsers') {
    return {
      success: true,
      mode: 'dsers',
      supplierOrderId: `dsers-${order.id || Date.now()}`,
      trackingNumber: null,
      note: 'Order routed to DSers workflow.'
    };
  }

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

  try {
    const response = await aliExpressApiRequest('/orders/create', 'POST', payload);
    const contentType = (response.headers?.['content-type'] || '').toLowerCase();

    if (contentType.includes('text/html')) {
      return {
        success: false,
        mode: 'aliexpress-unavailable',
        supplierOrderId: null,
        trackingNumber: null,
        note: 'AliExpress returned an HTML maintenance response.'
      };
    }

    return response.data;
  } catch (error) {
    return {
      success: false,
      mode: 'aliexpress-error',
      supplierOrderId: null,
      trackingNumber: null,
      note: `AliExpress request failed: ${error.message}`
    };
  }
}

export async function syncAliExpressInventory() {
  if (config.fulfillment.mode === 'dsers') {
    console.log('Fulfillment mode is DSers. Skipping AliExpress inventory sync.');
    return [];
  }

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

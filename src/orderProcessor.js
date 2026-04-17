import { createAliExpressOrder } from './aliexpress.js';
import { saveOrder } from './store.js';
import { updateWooOrderStatus } from './woocommerce.js';

export async function processOrder(order) {
  if (!order || !order.id) {
    throw new Error('Order payload is invalid or missing order ID');
  }

  const fulfillment = await createAliExpressOrder(order);
  let wooUpdate = null;
  let statusUpdate = 'on-hold';

  if (fulfillment && fulfillment.success) {
    statusUpdate = 'processing';
  } else if (fulfillment && fulfillment.mode === 'stub') {
    statusUpdate = 'processing';
  }

  try {
    wooUpdate = await updateWooOrderStatus(order.id, statusUpdate);
  } catch (error) {
    console.warn(`Failed to update WooCommerce order ${order.id} status:`, error.message);
  }

  const record = {
    createdAt: new Date().toISOString(),
    orderId: order.id,
    originalWooStatus: order.status,
    updatedWooStatus: statusUpdate,
    customer: order.billing || order.customer || {},
    lineItems: order.line_items || order.items || [],
    fulfillment,
    wooUpdate
  };

  await saveOrder(record);
  return record;
}

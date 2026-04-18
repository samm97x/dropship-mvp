import { createAliExpressOrder } from './aliexpress.js';
import { saveOrder } from './store.js';
import { updateWooOrderStatus } from './woocommerce.js';
import { sendFailureAlert } from './alerts.js';

export async function processOrder(order) {
  try {
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
      await sendFailureAlert({
        title: 'WooCommerce status update failed',
        orderId: order.id,
        stage: 'woo-status-update',
        error
      });
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
  } catch (error) {
    await sendFailureAlert({
      title: 'Order processing failed',
      orderId: order?.id,
      stage: 'order-processing',
      error
    });
    throw error;
  }
}

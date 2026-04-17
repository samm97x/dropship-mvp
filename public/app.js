async function fetchOrders() {
  const response = await fetch('/api/orders');
  if (!response.ok) throw new Error('Failed to fetch orders');
  return response.json();
}

async function testOrder() {
  const response = await fetch('/test-order', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to create test order');
  return response.json();
}

function createOrderCard(order) {
  const card = document.createElement('div');
  card.className = 'order-card';
  card.innerHTML = `
    <h3>Order #${order.orderId}</h3>
    <p><strong>Original status:</strong> ${order.originalWooStatus || 'n/a'}</p>
    <p><strong>Updated status:</strong> <span class="tag">${order.updatedWooStatus || 'n/a'}</span></p>
    <p><strong>Items:</strong> ${order.lineItems.length}</p>
    <p><strong>Supplier:</strong> ${order.fulfillment?.mode || 'unknown'}</p>
    <p><strong>Tracking:</strong> ${order.fulfillment?.trackingNumber || 'none'}</p>
  `;
  return card;
}

async function initDashboard() {
  try {
    const data = await fetchOrders();
    const orders = data.orders || [];
    document.getElementById('orders-count').textContent = orders.length;
    document.getElementById('last-sync').textContent = new Date().toLocaleString();

    const container = document.getElementById('orders-container');
    container.innerHTML = '';

    if (!orders.length) {
      container.innerHTML = '<p>No orders have been processed yet.</p>';
      return;
    }

    orders.slice().reverse().forEach((order) => {
      container.appendChild(createOrderCard(order));
    });
  } catch (error) {
    document.getElementById('orders-count').textContent = 'Error';
    document.getElementById('last-sync').textContent = '--';
    document.getElementById('orders-container').innerHTML = `<p>Error loading orders: ${error.message}</p>`;
  }
}

document.getElementById('test-order-btn').addEventListener('click', async () => {
  try {
    await testOrder();
    initDashboard(); // Refresh orders
  } catch (error) {
    alert('Test order failed: ' + error.message);
  }
});

initDashboard();

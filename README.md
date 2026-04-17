# Dropship MVP

A starter backend for automated WooCommerce & AliExpress dropshipping.

## What this includes
- WooCommerce webhook receiver for new orders
- WooCommerce product sync helper
- AliExpress automation stub for auto-fulfillment
- Background cron jobs for product and fulfillment sync
- Modular code ready for real API keys and production wiring

## Setup
1. Copy `.env.example` to `.env`
2. Fill in your WooCommerce and AliExpress credentials
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

## Endpoints
- `POST /webhook/woocommerce` - WooCommerce order webhook
- `GET /health` - health check
- `GET /api/orders` - returns saved order activity
- `GET /dashboard` - simple browser dashboard

## Next steps
- Add a secure database for orders and products
- Extend `src/aliexpress.js` with real AliExpress API calls
- Improve webhook processing with retries and error handling
- Add order mapping from WooCommerce line items to AliExpress SKUs

## Notes
WooCommerce webhook requests are verified using `WOOCOMMERCE_WEBHOOK_SECRET`.

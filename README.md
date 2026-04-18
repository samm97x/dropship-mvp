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
3. Optional but recommended for production: set `DATABASE_URL` (Railway Postgres)
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

## Storage
- If `DATABASE_URL` is set, orders are stored in Postgres (persistent across deploys).
- If `DATABASE_URL` is missing, orders are stored in `data/orders.json` (ephemeral in many cloud environments).

## Failure Alerts
You can receive alerts when order processing or WooCommerce status updates fail.

- Discord: set `ALERTS_DISCORD_WEBHOOK_URL`
- Email (SMTP): set all of these
   - `ALERTS_FROM_EMAIL`
   - `ALERTS_TO_EMAIL`
   - `ALERTS_SMTP_HOST`
   - `ALERTS_SMTP_PORT`
   - `ALERTS_SMTP_SECURE` (`true` for SSL port 465, else `false`)
   - `ALERTS_SMTP_USER`
   - `ALERTS_SMTP_PASS`

If both Discord and email are configured, both channels are used.

## Next steps
- Add a secure database for orders and products
- Extend `src/aliexpress.js` with real AliExpress API calls
- Improve webhook processing with retries and error handling
- Add order mapping from WooCommerce line items to AliExpress SKUs

## Notes
WooCommerce webhook requests are verified using `WOOCOMMERCE_WEBHOOK_SECRET`.

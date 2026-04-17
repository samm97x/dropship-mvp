import dotenv from 'dotenv';

dotenv.config();

export default {
  port: Number(process.env.PORT || 4000),
  woo: {
    storeUrl: process.env.WOOCOMMERCE_STORE_URL,
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
    webhookSecret: process.env.WOOCOMMERCE_WEBHOOK_SECRET
  },
  aliexpress: {
    baseUrl: process.env.ALIEXPRESS_API_BASE,
    apiKey: process.env.ALIEXPRESS_API_KEY,
    apiSecret: process.env.ALIEXPRESS_API_SECRET,
    shopId: process.env.ALIEXPRESS_SHOP_ID
  }
};

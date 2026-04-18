import dotenv from 'dotenv';

dotenv.config();

export default {
  port: Number(process.env.PORT || 4000),
  database: {
    url: process.env.DATABASE_URL
  },
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
  },
  alerts: {
    discordWebhookUrl: process.env.ALERTS_DISCORD_WEBHOOK_URL,
    fromEmail: process.env.ALERTS_FROM_EMAIL,
    toEmail: process.env.ALERTS_TO_EMAIL,
    smtpHost: process.env.ALERTS_SMTP_HOST,
    smtpPort: Number(process.env.ALERTS_SMTP_PORT || 587),
    smtpSecure: process.env.ALERTS_SMTP_SECURE === 'true',
    smtpUser: process.env.ALERTS_SMTP_USER,
    smtpPass: process.env.ALERTS_SMTP_PASS
  }
};

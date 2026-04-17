import { CronJob } from 'cron';
import { syncProducts } from './woocommerce.js';
import { syncAliExpressInventory } from './aliexpress.js';

export function startProductSync() {
  const job = new CronJob(
    '0 */6 * * *',
    async () => {
      console.log('[CRON] Product sync started');
      await syncProducts();
      console.log('[CRON] Product sync completed');
    },
    null,
    true,
    'UTC'
  );

  job.start();
}

export function startOrderSync() {
  const job = new CronJob(
    '0 * * * *',
    async () => {
      console.log('[CRON] AliExpress inventory sync started');
      await syncAliExpressInventory();
      console.log('[CRON] AliExpress inventory sync completed');
    },
    null,
    true,
    'UTC'
  );

  job.start();
}

// jobs/cronJobs.js
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendAndSaveNotification } from '../services/notificationService';

const prisma = new PrismaClient();

// Har raat Midnight (00:00) par chalega
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily stock audit for notifications...');

  const now = new Date();

  // -------------------------------------------------------------
  // 1. EXPIRING IN 1 MONTH & ALREADY EXPIRED (ProductBatch)
  // -------------------------------------------------------------
  const targetExpiringDate = new Date();
  targetExpiringDate.setDate(now.getDate() + 30); // Exactly 30 days ahead

  const batches = await prisma.productBatch.findMany({
    include: {
      shopInventory: true,
    },
  });

  for (const batch of batches) {
    // Only check batches that currently have stock in shop
    const currentStock = batch.shopInventory.reduce((acc, inv) => acc + inv.quantity, 0);
    if (currentStock <= 0) continue;

    const expDate = new Date(batch.expiryDate);

    // Expire ho chuka hai (Today)
    if (expDate <= now) {
      await sendAndSaveNotification({
        shopId: batch.shopId,
        title: '🔴 Product Expired',
        body: `Batch ${batch.batchNumber} of product "${batch.productName}" has expired!`,
        type: 'EXPIRED',
      });
    }
    // Expire hone me 30 din ya kam bache hain
    else if (expDate <= targetExpiringDate) {
      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      await sendAndSaveNotification({
        shopId: batch.shopId,
        title: '⏳ Expiry Notice (1 Month)',
        body: `Batch ${batch.batchNumber} of "${batch.productName}" will expire in ${daysLeft} days.`,
        type: 'EXPIRING_SOON',
      });
    }
  }

  // -------------------------------------------------------------
  // 2. DEAD STOCK (Not Sold in last 90 Days)
  // -------------------------------------------------------------
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const shops = await prisma.shop.findMany({ select: { id: true } });

  for (const shop of shops) {
    // Un Products/Batches ki IDs jin me pichle 90 din me koi sale hui hai
    const recentSales = await prisma.saleItem.findMany({
      where: {
        sale: {
          shopId: shop.id,
          createdAt: { gte: ninetyDaysAgo },
        },
      },
      select: { productId: true, looseItemId: true },
    });

    const soldProductIds = new Set(recentSales.map((s) => s.productId).filter(Boolean));
    const soldLooseItemIds = new Set(recentSales.map((s) => s.looseItemId).filter(Boolean));

    // Aisa stock jo available hai lekin 90 days se nahi bika
    const deadInventory = await prisma.shopInventory.findMany({
      where: {
        shopId: shop.id,
        quantity: { gt: 0 },
        productId: { notIn: Array.from(soldProductIds) },
      },
    });

    for (const item of deadInventory) {
      await sendAndSaveNotification({
        shopId: shop.id,
        title: '📦 Dead Stock Alert',
        body: `Item "${item.productName}" has not been sold in the last 90 days. Consider putting a discount!`,
        type: 'DEAD_STOCK',
      });
    }
  }
});
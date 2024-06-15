import { int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';

export const guestbookSchema = mysqlTable('Guestbook', {
  id: int('id').primaryKey().autoincrement().notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  body: varchar('body', { length: 255 }).notNull(),
  createdAt: int('createdAt').default(0).notNull(),
  updatedAt: int('updatedAt').default(0).notNull(),
});

export const qrCodeSchema = mysqlTable('QRCode', {
  id: int('id').primaryKey().autoincrement().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  shop: varchar('shop', { length: 255 }).notNull(),
  productId: varchar('productId', { length: 255 }).notNull(),
  productHandle: varchar('productHandle', { length: 255 }).notNull(),
  productVariantId: varchar('productVariantId', { length: 255 }).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  scans: int('scans').default(0).notNull(),
  createdAt: int('createdAt').default(0).notNull(),
});

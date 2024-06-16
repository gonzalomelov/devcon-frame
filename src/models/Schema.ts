import { int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

export const guestbookSchema = mysqlTable('Guestbook', {
  id: int('id').primaryKey().autoincrement().notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  body: varchar('body', { length: 255 }).notNull(),
  createdAt: int('createdAt').default(0).notNull(),
  updatedAt: int('updatedAt').default(0).notNull(),
});

export const frameSchema = mysqlTable('Frame', {
  id: int('id').primaryKey().autoincrement().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  shop: varchar('shop', { length: 255 }).notNull(),
  productId: varchar('productId', { length: 255 }).notNull(),
  productHandle: varchar('productHandle', { length: 255 }).notNull(),
  productVariantId: varchar('productVariantId', { length: 255 }).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  scans: int('scans').default(0).notNull(),
  createdAt: int('createdAt').default(0).notNull(),
  image: varchar('image', { length: 255 }).notNull(),
  button: varchar('button', { length: 255 }).notNull(),
});

export const productSchema = mysqlTable('Product', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  shop: varchar('shop', { length: 255 }).notNull(),
  handle: varchar('handle', { length: 255 }).notNull(),
  variantId: varchar('variantId', { length: 255 }).notNull(),
  alt: text('alt').notNull(),
  image: varchar('image', { length: 255 }).notNull(),
  createdAt: int('createdAt').default(0).notNull(),
});

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_slug_key" ON "ExpenseCategory"("slug");

-- Seed default categories
INSERT INTO "ExpenseCategory" ("id", "slug", "label", "icon", "color", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid()::text, 'housing',       'Housing',       'Home',       'text-blue-400 bg-blue-500/10 border-blue-500/20',     0, NOW()),
  (gen_random_uuid()::text, 'childcare',     'Childcare',     'Baby',       'text-pink-400 bg-pink-500/10 border-pink-500/20',     1, NOW()),
  (gen_random_uuid()::text, 'subscriptions', 'Subscriptions', 'RefreshCw',  'text-violet-400 bg-violet-500/10 border-violet-500/20', 2, NOW()),
  (gen_random_uuid()::text, 'insurance',     'Insurance',     'Shield',     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 3, NOW()),
  (gen_random_uuid()::text, 'utilities',     'Utilities',     'Zap',        'text-amber-400 bg-amber-500/10 border-amber-500/20',  4, NOW()),
  (gen_random_uuid()::text, 'transport',     'Transport',     'Car',        'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',     5, NOW()),
  (gen_random_uuid()::text, 'pets',          'Pets',          'PawPrint',   'text-rose-400 bg-rose-500/10 border-rose-500/20',     6, NOW()),
  (gen_random_uuid()::text, 'groceries',     'Groceries',     'ShoppingCart','text-green-400 bg-green-500/10 border-green-500/20', 7, NOW()),
  (gen_random_uuid()::text, 'lifestyle',     'Lifestyle',     'Sparkles',      'text-orange-400 bg-orange-500/10 border-orange-500/20', 8, NOW()),
  (gen_random_uuid()::text, 'other',         'Other',         'MoreHorizontal','text-gray-400 bg-gray-500/10 border-gray-500/20', 9, NOW());

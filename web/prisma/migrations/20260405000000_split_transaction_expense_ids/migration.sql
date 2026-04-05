-- Split Transaction.recurringExpenseId into two typed columns:
--   recurringExpenseId  → FK → RecurringExpense (fixed bills)
--   variableExpenseId   → FK → VariableExpense   (spend buckets)
--
-- Step 1: add the new column (nullable, no FK yet — backfill script runs next)
ALTER TABLE "Transaction" ADD COLUMN "variableExpenseId" TEXT;

-- Step 2: backfill — move any IDs that exist in VariableExpense into the new column
UPDATE "Transaction" t
SET
  "variableExpenseId" = t."recurringExpenseId",
  "recurringExpenseId" = NULL
WHERE t."recurringExpenseId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "VariableExpense" ve WHERE ve.id = t."recurringExpenseId"
  );

-- Step 3: add FK constraints now that data is clean
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_recurringExpenseId_fkey"
  FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"(id) ON DELETE SET NULL;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_variableExpenseId_fkey"
  FOREIGN KEY ("variableExpenseId") REFERENCES "VariableExpense"(id) ON DELETE SET NULL;

-- Step 4: index the new column alongside the existing one
CREATE INDEX "Transaction_userId_variableExpenseId_idx" ON "Transaction"("userId", "variableExpenseId");

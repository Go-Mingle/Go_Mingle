-- A one-off Safepay checkout test on the live site carried an internal label.
-- Give it a neutral one; no other rows are touched.
UPDATE "escrow_holds" SET "mingler_name" = 'Safepay test payment' WHERE "mingler_name" LIKE 'Safepay check (%)';

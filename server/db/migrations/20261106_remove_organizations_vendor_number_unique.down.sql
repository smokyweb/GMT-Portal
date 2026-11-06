-- Rollback: re-enforce one organization per nonblank Address Book Number.
-- This will fail safely if duplicate values were intentionally added after the up migration.
DROP INDEX IF EXISTS organizations_vendor_number_idx;
CREATE UNIQUE INDEX organizations_vendor_number_unique
  ON organizations (vendor_number)
  WHERE vendor_number IS NOT NULL AND btrim(vendor_number) <> '';

-- Address Book Number (organizations.vendor_number) is shareable.
DROP INDEX IF EXISTS organizations_vendor_number_unique;
CREATE INDEX IF NOT EXISTS organizations_vendor_number_idx
  ON organizations (vendor_number)
  WHERE vendor_number IS NOT NULL AND btrim(vendor_number) <> '';

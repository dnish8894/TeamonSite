-- Split warranty into two: the existing warranty_start/warranty_expiry are the
-- CLIENT warranty period; these new columns hold the IQL/Vendor warranty separately.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS vendor_warranty_start DATE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS vendor_warranty_end DATE;

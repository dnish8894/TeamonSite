-- Track when each device was last serviced. Auto-stamped when a ticket referencing
-- the device is resolved/closed (PM visit or breakdown fix).
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_service_date DATE;

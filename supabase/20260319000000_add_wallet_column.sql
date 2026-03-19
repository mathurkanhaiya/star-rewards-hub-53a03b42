-- Add wallet column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow update
CREATE POLICY "Allow wallet update"
ON users
FOR UPDATE
USING (true);

-- Allow read
CREATE POLICY "Allow wallet read"
ON users
FOR SELECT
USING (true);
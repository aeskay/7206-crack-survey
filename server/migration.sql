-- Migration to add steel_ratio column to sections table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sections' AND column_name='steel_ratio') THEN
        ALTER TABLE sections ADD COLUMN steel_ratio FLOAT DEFAULT 0.0;
    END IF;
END $$;

-- Migration: Align schema with current code implementation
-- This migration adds salary1 and salary2 columns to the months table
-- and removes the separate salaries table if it exists

-- Step 1: Add salary columns to months table
ALTER TABLE public.months 
ADD COLUMN IF NOT EXISTS salary1 numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS salary2 numeric DEFAULT 0;

-- Step 2: Migrate data from salaries table (if it exists) and then drop it
DO $$
BEGIN
  -- Check if salaries table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'salaries'
  ) THEN
    
    -- Migrate salary1 data
    UPDATE public.months m
    SET salary1 = s.value
    FROM public.salaries s
    WHERE s.month_id = m.id 
    AND s.person_identifier = 'salary1';
    
    -- Migrate salary2 data
    UPDATE public.months m
    SET salary2 = s.value
    FROM public.salaries s
    WHERE s.month_id = m.id 
    AND s.person_identifier = 'salary2';
    
    -- Drop the old salaries table
    DROP TABLE public.salaries;
    
    RAISE NOTICE 'Salaries table migrated and dropped successfully';
  ELSE
    RAISE NOTICE 'Salaries table does not exist, skipping migration';
  END IF;
END $$;

-- Step 3: Create unique constraint on user_id + month_code if it doesn't exist
-- This is required for the upsert operation in the code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'months_user_id_month_code_key'
  ) THEN
    ALTER TABLE public.months
    ADD CONSTRAINT months_user_id_month_code_key UNIQUE (user_id, month_code);
    
    RAISE NOTICE 'Unique constraint created on months(user_id, month_code)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Step 4: Verify the migration
DO $$
DECLARE
  month_count integer;
  salary_count integer;
BEGIN
  SELECT COUNT(*) INTO month_count FROM public.months;
  SELECT COUNT(*) INTO salary_count FROM public.months WHERE salary1 > 0 OR salary2 > 0;
  
  RAISE NOTICE 'Migration complete: % months total, % with salaries', month_count, salary_count;
END $$;

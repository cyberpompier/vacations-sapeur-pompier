/*
      # Add intervention_count to vacations table and ensure RLS policies

      1. Modified Tables
        - `vacations`
          - Add `intervention_count` (integer, default 0) if it doesn't exist.
      2. Security
        - Ensure RLS is enabled on `vacations` table.
        - Create or ensure RLS policies for INSERT, UPDATE, SELECT, and DELETE on `vacations` table, allowing authenticated users to manage their own data.
    */

    -- Add intervention_count column if it doesn't exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vacations' AND column_name = 'intervention_count'
      ) THEN
        ALTER TABLE vacations ADD COLUMN intervention_count integer DEFAULT 0;
      END IF;
    END $$;

    -- Ensure RLS is enabled for the vacations table
    ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

    -- Policy for INSERT: Allow authenticated users to insert their own vacations
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own vacations' AND tablename = 'vacations') THEN
        CREATE POLICY "Users can insert their own vacations"
          ON vacations
          FOR INSERT
          TO authenticated
          WITH CHECK (auth.uid() = user_id);
      END IF;
    END $$;

    -- Policy for UPDATE: Allow authenticated users to update their own vacations
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own vacations' AND tablename = 'vacations') THEN
        CREATE POLICY "Users can update their own vacations"
          ON vacations
          FOR UPDATE
          TO authenticated
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
      END IF;
    END $$;

    -- Policy for SELECT: Allow authenticated users to view their own vacations
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own vacations' AND tablename = 'vacations') THEN
        CREATE POLICY "Users can view their own vacations"
          ON vacations
          FOR SELECT
          TO authenticated
          USING (auth.uid() = user_id);
      END IF;
    END $$;

    -- Policy for DELETE: Allow authenticated users to delete their own vacations
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own vacations' AND tablename = 'vacations') THEN
        CREATE POLICY "Users can delete their own vacations"
          ON vacations
          FOR DELETE
          TO authenticated
          USING (auth.uid() = user_id);
      END IF;
    END $$;
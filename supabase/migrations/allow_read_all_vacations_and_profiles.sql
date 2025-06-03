/*
      # Allow authenticated users to view all vacations and profiles

      1. Security
        - Add RLS policy to `vacations` table to allow authenticated users to `SELECT` all rows.
        - Add RLS policy to `profiles` table to allow authenticated users to `SELECT` all rows (specifically for `id`, `username`, `avatar_url`).
      2. Important Notes
        - These policies are broad and allow authenticated users to see all vacation periods and basic profile information (username, avatar).
        - For more granular control, specific column permissions or more complex `USING` clauses could be implemented.
    */

    -- Policy for vacations table
    DROP POLICY IF EXISTS "Allow authenticated users to view all vacations" ON public.vacations;
    CREATE POLICY "Allow authenticated users to view all vacations"
      ON public.vacations
      FOR SELECT
      TO authenticated
      USING (true);

    -- Policy for profiles table
    DROP POLICY IF EXISTS "Allow authenticated users to view all profiles" ON public.profiles;
    CREATE POLICY "Allow authenticated users to view all profiles"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (true);
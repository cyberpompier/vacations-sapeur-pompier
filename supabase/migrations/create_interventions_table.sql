/*
  # Create interventions table

  1. New Tables
    - `interventions`
      - `id` (uuid, primary key, default gen_random_uuid())
      - `user_id` (uuid, foreign key to auth.users, not null)
      - `start_time` (timestamptz, not null, default now())
      - `end_time` (timestamptz, nullable)
      - `is_active` (boolean, not null, default true) - Indicates if the intervention is currently ongoing.
      - `created_at` (timestamptz, default now())
  2. Security
    - Enable RLS on `interventions` table
    - Add policy for authenticated users to read their own interventions
    - Add policy for authenticated users to create their own interventions
    - Add policy for authenticated users to update their own interventions
  */

CREATE TABLE IF NOT EXISTS interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their own interventions"
  ON interventions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create their own interventions"
  ON interventions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own interventions"
  ON interventions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
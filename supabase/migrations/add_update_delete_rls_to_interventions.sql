/*
  # Add RLS policies for update and delete on interventions table

  1. Security
    - Add RLS policy for authenticated users to update their own interventions on `interventions` table.
    - Add RLS policy for authenticated users to delete their own interventions on `interventions` table.
*/

CREATE POLICY "Users can update their own interventions"
  ON interventions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interventions"
  ON interventions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
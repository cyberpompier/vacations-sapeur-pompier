/*
      # Create profiles table and RLS policies

      1. New Tables
        - `profiles`
          - `id` (uuid, primary key, references auth.users)
          - `nom` (text, default '')
          - `prenom` (text, default '')
          - `caserne_affectation` (text, default '')
          - `grade` (text, default '')
          - `photo_url` (text, default '')
          - `updated_at` (timestamp with timezone, default now())
      2. Security
        - Enable RLS on `profiles` table
        - Add policies for authenticated users to:
          - Select their own profile
          - Insert their own profile
          - Update their own profile
    */

    CREATE TABLE IF NOT EXISTS profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      nom text DEFAULT '',
      prenom text DEFAULT '',
      caserne_affectation text DEFAULT '',
      grade text DEFAULT '',
      photo_url text DEFAULT '',
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their own profile."
      ON profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);

    CREATE POLICY "Users can create their own profile."
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);

    CREATE POLICY "Users can update their own profile."
      ON profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id);
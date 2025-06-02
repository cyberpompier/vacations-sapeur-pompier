/*
  # Schéma de la base de données pour la gestion des grades et des profils utilisateurs

  Cette migration assure la bonne structure des tables `settings` et `profiles`
  pour la gestion des taux horaires par grade et la sélection du grade par l'utilisateur.

  1. Nouvelle table `profiles`
    - `id` (uuid, clé primaire, référence `auth.users.id`)
    - `selected_grade` (text, non nul, par défaut 'Pompier')
    - `created_at` (timestamp, par défaut `now()`)
    - `updated_at` (timestamp, par défaut `now()`)
  2. Modifications de la table `settings`
    - Ajout de la colonne `grade` (text, non nul, par défaut 'Pompier').
    - Suppression de l'ancienne contrainte d'unicité `settings_user_id_activity_type_key` si elle existe.
    - Ajout d'une nouvelle contrainte d'unicité sur `user_id`, `activity_type`, et `grade`.
  3. Sécurité (RLS)
    - Activation de RLS sur la table `profiles`.
    - Politiques RLS pour `profiles`:
      - `SELECT`: Les utilisateurs authentifiés peuvent lire leur propre profil.
      - `INSERT`: Les utilisateurs authentifiés peuvent créer leur propre profil.
      - `UPDATE`: Les utilisateurs authentifiés peuvent mettre à jour leur propre profil.
    - Les politiques RLS existantes sur `settings` sont toujours valides car elles se basent sur `user_id`.
  4. Triggers
    - Ajout d'un trigger `set_updated_at` sur la table `profiles` pour mettre à jour `updated_at` automatiquement.
  5. Notes importantes
    - Les enregistrements existants dans la table `settings` se verront attribuer le grade par défaut 'Pompier'.
*/

-- Création de la table 'profiles' si elle n'existe pas
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_grade text NOT NULL DEFAULT 'Pompier',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activation de RLS sur la table 'profiles'
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour la table 'profiles'
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Fonction pour mettre à jour la colonne 'updated_at'
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour la table 'profiles'
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ajout de la colonne 'grade' à la table 'settings' si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'grade'
  ) THEN
    ALTER TABLE settings ADD COLUMN grade text NOT NULL DEFAULT 'Pompier';
  END IF;
END $$;

-- Suppression de l'ancienne contrainte d'unicité si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'settings_user_id_activity_type_key'
  ) THEN
    ALTER TABLE settings DROP CONSTRAINT settings_user_id_activity_type_key;
  END IF;
END $$;

-- Ajout de la nouvelle contrainte d'unicité incluant 'grade'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'settings_user_id_activity_type_grade_key'
  ) THEN
    ALTER TABLE settings ADD CONSTRAINT settings_user_id_activity_type_grade_key UNIQUE (user_id, activity_type, grade);
  END IF;
END $$;

-- Mise à jour de la colonne 'updated_at' pour les lignes existantes après l'ajout de la colonne 'grade'
-- Ceci est optionnel mais assure que 'updated_at' reflète le moment de la migration pour les anciennes entrées.
UPDATE settings SET updated_at = now() WHERE updated_at IS NULL;
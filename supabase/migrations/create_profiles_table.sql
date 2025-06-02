/*
  # Création de la table 'profiles' et configuration RLS

  Cette migration crée la table `profiles` pour stocker les préférences utilisateur,
  notamment le grade sélectionné par l'utilisateur.

  1. Nouvelles Tables
    - `profiles`
      - `id` (uuid, clé primaire, référence `auth.users.id`) : L'identifiant de l'utilisateur.
      - `selected_grade` (text, non nul, par défaut 'Pompier') : Le grade que l'utilisateur a choisi.
      - `created_at` (timestamptz, par défaut maintenant) : Horodatage de la création de l'enregistrement.
      - `updated_at` (timestamptz, par défaut maintenant) : Horodatage de la dernière mise à jour de l'enregistrement.
  2. Sécurité
    - RLS (Row Level Security) est activé sur la table `profiles`.
    - Des politiques RLS sont ajoutées pour permettre aux utilisateurs authentifiés de :
      - `SELECT` (lire) leur propre profil.
      - `INSERT` (insérer) un nouveau profil pour eux-mêmes.
      - `UPDATE` (modifier) leur propre profil.
*/

-- Création de la table 'profiles' si elle n'existe pas
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_grade text NOT NULL DEFAULT 'Pompier',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activation de la sécurité au niveau des lignes (RLS) pour la table 'profiles'
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Création de la politique RLS pour permettre aux utilisateurs authentifiés de lire leur propre profil
CREATE POLICY "Authenticated users can view their own profile."
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Création de la politique RLS pour permettre aux utilisateurs authentifiés d'insérer leur propre profil
CREATE POLICY "Authenticated users can insert their own profile."
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Création de la politique RLS pour permettre aux utilisateurs authentifiés de modifier leur propre profil
CREATE POLICY "Authenticated users can update their own profile."
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger pour la colonne 'updated_at' sur la table 'profiles'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_on_profiles'
  ) THEN
    CREATE TRIGGER set_updated_at_on_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); -- Réutilise la fonction existante
  END IF;
END $$;
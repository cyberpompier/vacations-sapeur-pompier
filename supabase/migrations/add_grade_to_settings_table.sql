/*
  # Ajout de la colonne 'grade' à la table 'settings' et mise à jour des contraintes

  Cette migration modifie la table `settings` pour inclure une colonne `grade`,
  permettant de définir des taux horaires spécifiques par grade.

  1. Modifications de la table `settings`
    - Ajout de la colonne `grade` (text, non nul, par défaut 'Pompier').
    - Suppression de la contrainte d'unicité existante `settings_user_id_activity_type_key`.
    - Ajout d'une nouvelle contrainte d'unicité sur `user_id`, `activity_type`, et `grade`.
  2. Notes importantes
    - Les enregistrements existants dans la table `settings` se verront attribuer le grade par défaut 'Pompier'.
    - Les politiques RLS existantes sont toujours valides car elles se basent sur `user_id`.
*/

-- Ajout de la colonne 'grade' si elle n'existe pas
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
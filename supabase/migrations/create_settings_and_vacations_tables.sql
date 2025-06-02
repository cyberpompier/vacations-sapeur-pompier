/*
  # Création des tables settings et vacations

  1. Nouvelles Tables
    - `settings`
      - `id` (uuid, clé primaire, valeur par défaut générée)
      - `user_id` (uuid, clé étrangère vers auth.users, non nul)
      - `activity_type` (text, type d'activité, unique par utilisateur)
      - `hourly_rate` (numeric, taux horaire pour l'activité, non nul, par défaut 0.0)
      - `created_at` (timestamp, date de création, par défaut maintenant)
    - `vacations`
      - `id` (uuid, clé primaire, valeur par défaut générée)
      - `user_id` (uuid, clé étrangère vers auth.users, non nul)
      - `activity_type` (text, type d'activité, non nul)
      - `start_time` (timestamptz, heure de début de la vacation, non nul)
      - `end_time` (timestamptz, heure de fin de la vacation, non nul)
      - `duration_minutes` (integer, durée en minutes, non nul, par défaut 0)
      - `hourly_rate_applied` (numeric, taux horaire appliqué au moment de l'enregistrement, non nul, par défaut 0.0)
      - `total_amount` (numeric, montant total calculé, non nul, par défaut 0.0)
      - `notes` (text, notes facultatives, par défaut chaîne vide)
      - `created_at` (timestamptz, date de création, par défaut maintenant)

  2. Sécurité
    - Activation de RLS sur les tables `settings` et `vacations`.
    - Politiques RLS pour permettre aux utilisateurs authentifiés de :
      - Insérer, sélectionner, mettre à jour et supprimer leurs propres `settings`.
      - Insérer, sélectionner, mettre à jour et supprimer leurs propres `vacations`.
*/

-- Table des paramètres (taux horaires)
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  hourly_rate numeric DEFAULT 0.0 NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, activity_type) -- Assure qu'un utilisateur n'a qu'un seul taux par type d'activité
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their own settings"
  ON settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table des vacations
CREATE TABLE IF NOT EXISTS vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_minutes integer DEFAULT 0 NOT NULL,
  hourly_rate_applied numeric DEFAULT 0.0 NOT NULL,
  total_amount numeric DEFAULT 0.0 NOT NULL,
  notes text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their own vacations"
  ON vacations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
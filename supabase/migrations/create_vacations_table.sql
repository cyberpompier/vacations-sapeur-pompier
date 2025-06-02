/*
  # Création de la table vacations et configuration RLS

  1. Nouvelle Table
    - `vacations`
      - `id` (uuid, clé primaire, générée automatiquement)
      - `user_id` (uuid, clé étrangère vers auth.users, non nul)
      - `activity_type` (text, non nul, type d'activité)
      - `start_time` (timestamptz, non nul, heure de début de la vacation)
      - `end_time` (timestamptz, non nul, heure de fin de la vacation)
      - `duration_minutes` (integer, non nul, durée en minutes)
      - `hourly_rate_applied` (numeric, non nul, taux horaire appliqué au moment de l'enregistrement)
      - `total_amount` (numeric, non nul, montant total calculé)
      - `notes` (text, notes facultatives)
      - `created_at` (timestamp, par défaut maintenant)
      - `updated_at` (timestamp, par défaut maintenant, mis à jour à chaque modification)
  2. Sécurité
    - Activation de RLS sur la table `vacations`
    - Ajout de politiques RLS pour permettre aux utilisateurs authentifiés de :
      - Insérer leurs propres vacations.
      - Sélectionner leurs propres vacations.
      - Mettre à jour leurs propres vacations.
      - Supprimer leurs propres vacations.
  3. Notes
    - La colonne `updated_at` est gérée par un trigger pour une mise à jour automatique.
*/

CREATE TABLE IF NOT EXISTS vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 0,
  hourly_rate_applied numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger pour mettre à jour updated_at avant chaque mise à jour
DROP TRIGGER IF EXISTS update_vacations_updated_at ON vacations;
CREATE TRIGGER update_vacations_updated_at
BEFORE UPDATE ON vacations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); -- Réutilise la fonction définie pour 'settings'

ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to insert their own vacations
CREATE POLICY "Authenticated users can insert their own vacations"
  ON vacations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for authenticated users to select their own vacations"
  ON vacations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for authenticated users to update their own vacations
CREATE POLICY "Authenticated users can update their own vacations"
  ON vacations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for authenticated users to delete their own vacations
CREATE POLICY "Authenticated users can delete their own vacations"
  ON vacations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

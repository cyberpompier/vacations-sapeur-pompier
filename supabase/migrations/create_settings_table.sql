/*
  # Création de la table settings et configuration RLS

  1. Nouvelle Table
    - `settings`
      - `id` (uuid, clé primaire, générée automatiquement)
      - `user_id` (uuid, clé étrangère vers auth.users, non nul)
      - `activity_type` (text, non nul, type d'activité comme 'garde', 'astreinte', 'intervention')
      - `hourly_rate` (numeric, non nul, taux horaire)
      - `created_at` (timestamp, par défaut maintenant)
      - `updated_at` (timestamp, par défaut maintenant, mis à jour à chaque modification)
  2. Sécurité
    - Activation de RLS sur la table `settings`
    - Ajout de politiques RLS pour permettre aux utilisateurs authentifiés de :
      - Insérer leurs propres paramètres.
      - Sélectionner leurs propres paramètres.
      - Mettre à jour leurs propres paramètres.
      - Supprimer leurs propres paramètres.
  3. Notes
    - Un index unique est ajouté sur `user_id` et `activity_type` pour éviter les doublons et optimiser les upserts.
    - La colonne `updated_at` est gérée par un trigger pour une mise à jour automatique.
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT '',
  hourly_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer un index unique pour user_id et activity_type pour les upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_activity ON settings (user_id, activity_type);

-- Fonction pour mettre à jour la colonne updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour updated_at avant chaque mise à jour
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to insert their own settings
CREATE POLICY "Authenticated users can insert their own settings"
  ON settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for authenticated users to select their own settings
CREATE POLICY "Authenticated users can select their own settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for authenticated users to update their own settings
CREATE POLICY "Authenticated users can update their own settings"
  ON settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for authenticated users to delete their own settings
  ON settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

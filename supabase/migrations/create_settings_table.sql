/*
      # Création de la table 'settings' et configuration RLS

      Cette migration crée la table `settings` pour stocker les taux horaires personnalisés de chaque utilisateur.

      1. Nouvelles Tables
        - `settings`
          - `id` (uuid, clé primaire, générée automatiquement) : Identifiant unique pour chaque paramètre.
          - `user_id` (uuid, non nul) : L'identifiant de l'utilisateur Supabase auquel ce paramètre appartient. C'est une clé étrangère vers `auth.users.id`.
          - `activity_type` (text, non nul) : Le type d'activité (ex: 'garde', 'astreinte', 'intervention').
          - `hourly_rate` (numeric, non nul, par défaut 0) : Le taux horaire associé à l'activité.
          - `created_at` (timestamptz, par défaut maintenant) : Horodatage de la création de l'enregistrement.
          - `updated_at` (timestamptz, par défaut maintenant) : Horodatage de la dernière mise à jour de l'enregistrement.
      2. Contraintes
        - Une contrainte d'unicité est ajoutée sur `user_id` et `activity_type` pour s'assurer qu'un utilisateur n'a qu'un seul taux par type d'activité.
      3. Sécurité
        - RLS (Row Level Security) est activé sur la table `settings`.
        - Des politiques RLS sont ajoutées pour permettre aux utilisateurs authentifiés de :
          - `SELECT` (lire) leurs propres paramètres.
          - `INSERT` (insérer) de nouveaux paramètres pour eux-mêmes.
          - `UPDATE` (modifier) leurs propres paramètres.
    */

    -- Création de la table 'settings' si elle n'existe pas
    CREATE TABLE IF NOT EXISTS settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id),
      activity_type text NOT NULL,
      hourly_rate numeric NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Ajout d'une contrainte d'unicité pour s'assurer qu'un utilisateur n'a qu'un seul taux par type d'activité
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settings_user_id_activity_type_key'
      ) THEN
        ALTER TABLE settings ADD CONSTRAINT settings_user_id_activity_type_key UNIQUE (user_id, activity_type);
      END IF;
    END $$;

    -- Activation de la sécurité au niveau des lignes (RLS) pour la table 'settings'
    ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

    -- Création de la politique RLS pour permettre aux utilisateurs authentifiés de lire leurs propres paramètres
    CREATE POLICY "Authenticated users can view their own settings."
      ON settings
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    -- Création de la politique RLS pour permettre aux utilisateurs authentifiés d'insérer leurs propres paramètres
    CREATE POLICY "Authenticated users can insert their own settings."
      ON settings
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    -- Création de la politique RLS pour permettre aux utilisateurs authentifiés de modifier leurs propres paramètres
    CREATE POLICY "Authenticated users can update their own settings."
      ON settings
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- Fonction pour mettre à jour 'updated_at' automatiquement
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Trigger pour la colonne 'updated_at'
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_updated_at_on_settings'
      ) THEN
        CREATE TRIGGER set_updated_at_on_settings
        BEFORE UPDATE ON settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;
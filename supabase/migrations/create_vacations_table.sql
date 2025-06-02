/*
      # Création de la table 'vacations' et configuration RLS

      Cette migration crée la table `vacations` pour stocker les enregistrements de vacations des utilisateurs.
      Elle configure également le Row Level Security (RLS) pour assurer que chaque utilisateur ne peut
      accéder qu'à ses propres données de vacation.

      1. Nouvelles Tables
        - `vacations`
          - `id` (uuid, clé primaire, généré automatiquement)
          - `user_id` (uuid, non nul, clé étrangère vers `auth.users.id`, identifie le propriétaire de la vacation)
          - `activity_type` (text, non nul, type d'activité comme 'garde', 'astreinte', 'intervention')
          - `start_time` (timestamptz, non nul, heure de début de la vacation)
          - `end_time` (timestamptz, non nul, heure de fin de la vacation)
          - `duration_minutes` (integer, non nul, durée de la vacation en minutes)
          - `hourly_rate_applied` (numeric, non nul, taux horaire appliqué pour cette vacation)
          - `total_amount` (numeric, non nul, montant total calculé pour cette vacation)
          - `notes` (text, notes facultatives sur la vacation)
          - `created_at` (timestamptz, non nul, date de création de l'enregistrement, par défaut `now()`)

      2. Sécurité
        - Activation du RLS sur la table `vacations`.
        - Ajout de politiques RLS :
          - `vacations_select_policy`: Permet aux utilisateurs authentifiés de lire leurs propres enregistrements de vacations.
          - `vacations_insert_policy`: Permet aux utilisateurs authentifiés d'insérer de nouveaux enregistrements de vacations pour eux-mêmes.
          - `vacations_update_policy`: Permet aux utilisateurs authentifiés de mettre à jour leurs propres enregistrements de vacations.
          - `vacations_delete_policy`: Permet aux utilisateurs authentifiés de supprimer leurs propres enregistrements de vacations.
    */

    -- Création de la table 'vacations'
    CREATE TABLE IF NOT EXISTS vacations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id),
      activity_type text NOT NULL DEFAULT 'garde',
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      duration_minutes integer NOT NULL DEFAULT 0,
      hourly_rate_applied numeric NOT NULL DEFAULT 0.00,
      total_amount numeric NOT NULL DEFAULT 0.00,
      notes text DEFAULT '',
      created_at timestamptz DEFAULT now()
    );

    -- Activation du Row Level Security (RLS)
    ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

    -- Politique pour SELECT (lecture)
    CREATE POLICY vacations_select_policy
      ON vacations
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    -- Politique pour INSERT (création)
    CREATE POLICY vacations_insert_policy
      ON vacations
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    -- Politique pour UPDATE (mise à jour)
      ON vacations
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- Politique pour DELETE (suppression)
    CREATE POLICY vacations_delete_policy
      ON vacations
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
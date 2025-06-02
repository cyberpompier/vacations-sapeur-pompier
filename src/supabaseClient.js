import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Les variables d\'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies.');
  alert('Erreur de configuration Supabase. Veuillez vérifier les variables d\'environnement.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Vacations from './pages/Vacations';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import MaGarde from './pages/MaGarde';
import AuthForm from './components/AuthForm';
import { supabase } from './supabaseClient';
import './index.css';

function App() {
  const [currentPage, setCurrentPage] = useState('vacations');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, 'Session:', session);
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async (email, password) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (email, password) => {
    setLoading(true);
    console.log('Attempting sign up for:', email);
    // --- NOUVEAUX LOGS DE DÉBOGAGE ---
    console.log('Supabase client URL:', supabase.supabaseUrl);
    console.log('Supabase client Anon Key:', supabase.supabaseKey ? 'Present' : 'Missing');
    // --- FIN NOUVEAUX LOGS DE DÉBOGAGE ---
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          disableEmailConfirmation: true,
        },
      });

      if (error) {
        console.error('Sign up error details:', error); // Log de l'objet erreur complet
        alert('Erreur lors de l\'inscription: ' + error.message);
      } else {
        console.log('Sign up successful data:', data); // Log des données de succès
        alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      }
    } catch (err) {
      console.error('Unexpected error during sign up:', err);
      alert('Une erreur inattendue est survenue lors de l\'inscription.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    console.log('Attempting to sign out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error.message);
      alert('Erreur lors de la déconnexion: ' + error.message);
    } else {
      console.log('Sign out successful.');
    }
    setSession(null);
    setCurrentPage('vacations');
    setLoading(false);
  };

  if (loading) {
    return <div className="loading-container">Chargement...</div>;
  }

  return (
    <div className="app-container">
      <Header setCurrentPage={setCurrentPage} session={session} onSignOut={handleSignOut} />
      <main className="main-content">
        {!session ? (
          <AuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} loading={loading} />
        ) : (
          <>
            {currentPage === 'vacations' && <Vacations session={session} />}
            {currentPage === 'maGarde' && <MaGarde session={session} />}
            {currentPage === 'settings' && <Settings session={session} />}
            {currentPage === 'userProfile' && <UserProfile session={session} />}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;

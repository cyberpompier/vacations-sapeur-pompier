import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Vacations from './pages/Vacations';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile'; // Import UserProfile
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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
    } else {
      alert('Inscription réussie ! Veuillez vous connecter.');
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
    }
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
            {currentPage === 'settings' && <Settings session={session} />}
            {currentPage === 'userProfile' && <UserProfile session={session} />} {/* Render UserProfile */}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;

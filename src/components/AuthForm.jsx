import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './AuthForm.css'; // Assurez-vous de créer ce fichier CSS

function AuthForm({ onSignIn, onSignUp, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignInSubmit = (e) => {
    e.preventDefault();
    onSignIn(email, password);
  };

  const handleSignUpSubmit = (e) => {
    e.preventDefault();
    onSignUp(email, password);
  };

  return (
    <div className="auth-form-container">
      <h2>Connexion / Inscription</h2>
      <form onSubmit={handleSignInSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Votre email"
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
            required
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </button>
      </form>
      <div className="auth-actions">
        <p>Pas encore de compte ?</p>
        <button onClick={handleSignUpSubmit} disabled={loading} className="signup-button">
          {loading ? 'Inscription en cours...' : "S'inscrire"}
        </button>
      </div>
    </div>
  );
}

AuthForm.propTypes = {
  onSignIn: PropTypes.func.isRequired,
  onSignUp: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
};

export default AuthForm;

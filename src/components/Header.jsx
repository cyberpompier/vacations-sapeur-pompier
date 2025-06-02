import React from 'react';
import PropTypes from 'prop-types';
import './Header.css';

function Header({ setCurrentPage, session, onSignOut }) {
  return (
    <header className="header-container">
      <div className="header-left">
        <h1>Gestion Vacations</h1>
      </div>
      <nav className="header-nav">
        {session && (
          <>
            <button onClick={() => setCurrentPage('vacations')} className="nav-button">Vacations</button>
            <button onClick={() => setCurrentPage('settings')} className="nav-button">Paramètres</button>
            <button onClick={onSignOut} className="nav-button sign-out-button">Déconnexion</button>
          </>
        )}
      </nav>
    </header>
  );
}

Header.propTypes = {
  setCurrentPage: PropTypes.func.isRequired,
  session: PropTypes.object, // session can be null
  onSignOut: PropTypes.func.isRequired,
};

export default Header;

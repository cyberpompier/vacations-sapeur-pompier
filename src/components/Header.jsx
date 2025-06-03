import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Header.css';

function Header({ setCurrentPage, session, onSignOut }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleMenuItemClick = (page) => {
    setCurrentPage(page);
    setIsMenuOpen(false); // Close menu after selection
  };

  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)) {
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="header-container">
      <div className="header-left">
        <h1>Gestion Vacations</h1>
      </div>
      <nav className="header-nav">
        {session && (
          <div className="menu-wrapper"> {/* Ensure this wrapper is position: relative */}
            <button ref={buttonRef} onClick={toggleMenu} className="menu-toggle-button">
              <span className="hamburger-icon"></span>
              <span className="hamburger-icon"></span>
              <span className="hamburger-icon"></span>
            </button>
            <div ref={menuRef} className={`dropdown-menu ${isMenuOpen ? 'open' : ''}`}>
              <button onClick={() => handleMenuItemClick('vacations')} className="dropdown-item">Vacations</button>
              <button onClick={() => handleMenuItemClick('maGarde')} className="dropdown-item">Ma Garde</button> {/* New menu item */}
              <button onClick={() => handleMenuItemClick('userProfile')} className="dropdown-item">Profil</button>
              <button onClick={() => handleMenuItemClick('settings')} className="dropdown-item">Paramètres</button>
              <button onClick={onSignOut} className="dropdown-item sign-out-item">Déconnexion</button>
            </div>
          </div>
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

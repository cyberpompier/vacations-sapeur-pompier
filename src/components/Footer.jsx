import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer-container">
      <p>&copy; {new Date().getFullYear()} Gestion Vacations Sapeurs-Pompiers. Tous droits réservés.</p>
    </footer>
  );
}

export default Footer;

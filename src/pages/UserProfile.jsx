import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './UserProfile.css';

function UserProfile({ session }) {
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [caserneAffectation, setCaserneAffectation] = useState('');
  const [grade, setGrade] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    getProfile();
  }, [session]);

  async function getProfile() {
    try {
      setLoading(true);
      const { user } = session;

      let { data, error, status } = await supabase
        .from('profiles')
        .select(`nom, prenom, caserne_affectation, grade, photo_url`)
        .eq('id', user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setNom(data.nom);
        setPrenom(data.prenom);
        setCaserneAffectation(data.caserne_affectation);
        setGrade(data.grade);
        setPhotoUrl(data.photo_url);
      }
    } catch (error) {
      alert('Erreur lors du chargement du profil : ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(event) {
    event.preventDefault();

    try {
      setLoading(true);
      const { user } = session;

      const updates = {
        id: user.id,
        nom,
        prenom,
        caserne_affectation: caserneAffectation,
        grade,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      alert('Profil mis à jour !');
    } catch (error) {
      alert('Erreur lors de la mise à jour du profil : ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="user-profile-container">
      <h2>Mon Profil Utilisateur</h2>
      <form onSubmit={updateProfile} className="profile-form">
        <div className="form-group">
          <label htmlFor="nom">Nom:</label>
          <input
            id="nom"
            type="text"
            value={nom || ''}
            onChange={(e) => setNom(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="prenom">Prénom:</label>
          <input
            id="prenom"
            type="text"
            value={prenom || ''}
            onChange={(e) => setPrenom(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="caserne_affectation">Caserne d'affectation:</label>
          <input
            id="caserne_affectation"
            type="text"
            value={caserneAffectation || ''}
            onChange={(e) => setCaserneAffectation(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="grade">Grade:</label>
          <input
            id="grade"
            type="text"
            value={grade || ''}
            onChange={(e) => setGrade(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="photo_url">URL Photo:</label>
          <input
            id="photo_url"
            type="url"
            value={photoUrl || ''}
            onChange={(e) => setPhotoUrl(e.target.value)}
            disabled={loading}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Chargement...' : 'Mettre à jour le profil'}
        </button>
      </form>
    </div>
  );
}

UserProfile.propTypes = {
  session: PropTypes.object.isRequired,
};

export default UserProfile;

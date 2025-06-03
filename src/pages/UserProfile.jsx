import React, { useState, useEffect, useCallback } from 'react';
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
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null); // State to hold the selected file

  const gradesOptions = [
    'Sapeur',
    'Caporal',
    'Caporal-chef',
    'Sergent',
    'Sergent-chef',
    'Adjudant',
    'Adjudant-chef',
    'Lieutenant',
    'Capitaine',
  ];

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
        setGrade(gradesOptions.includes(data.grade) ? data.grade : '');
        setPhotoUrl(data.photo_url);
      }
    } catch (error) {
      alert('Erreur lors du chargement du profil : ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const uploadAvatar = useCallback(async (event) => {
    if (!avatarFile) {
      alert('Veuillez sélectionner un fichier à télécharger.');
      return;
    }

    try {
      setUploading(true);
      const { user } = session;
      const file = avatarFile;
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`; // Unique path for each user's avatar

      let { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true, // Overwrite if file with same name exists
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (publicUrlData && publicUrlData.publicUrl) {
        setPhotoUrl(publicUrlData.publicUrl);
        // Also update the profile in the database immediately after upload
        const updates = {
          id: user.id,
          photo_url: publicUrlData.publicUrl,
          updated_at: new Date().toISOString(),
        };
        let { error: updateError } = await supabase.from('profiles').upsert(updates);
        if (updateError) {
          throw updateError;
        }
        alert('Photo de profil téléchargée et mise à jour !');
      } else {
        throw new Error('Impossible d\'obtenir l\'URL publique de la photo.');
      }
    } catch (error) {
      alert('Erreur lors du téléchargement de la photo : ' + error.message);
    } finally {
      setUploading(false);
      setAvatarFile(null); // Clear the selected file after upload attempt
    }
  }, [session, avatarFile]);

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
        photo_url: photoUrl, // Use the photoUrl which might have been updated by uploadAvatar
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
          <select
            id="grade"
            value={grade || ''}
            onChange={(e) => setGrade(e.target.value)}
            disabled={loading}
          >
            <option value="">Sélectionnez un grade</option>
            {gradesOptions.map((optionGrade) => (
              <option key={optionGrade} value={optionGrade}>
                {optionGrade}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group photo-upload-group">
          <label htmlFor="avatar">Photo de profil:</label>
          {photoUrl && (
            <div className="avatar-preview">
              <img src={photoUrl} alt="Avatar" className="avatar-image" />
            </div>
          )}
          <input
            type="file"
            id="avatar"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files[0])}
            disabled={uploading || loading}
          />
          {avatarFile && (
            <p className="selected-file-name">Fichier sélectionné: {avatarFile.name}</p>
          )}
          <button
            type="button"
            onClick={uploadAvatar}
            disabled={uploading || loading || !avatarFile}
            className="upload-button"
          >
            {uploading ? 'Téléchargement...' : 'Télécharger la photo'}
          </button>
        </div>
        <button type="submit" disabled={loading || uploading}>
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

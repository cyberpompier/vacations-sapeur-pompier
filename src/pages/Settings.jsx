import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import PropTypes from 'prop-types';
import './Settings.css';

function Settings({ session }) {
  const [hourlyRates, setHourlyRates] = useState({
    garde: 0,
    astreinte: 0,
    intervention: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const activityTypes = ['garde', 'astreinte', 'intervention'];

  useEffect(() => {
    if (session?.user?.id) { // Fetch rates only if user is logged in
      fetchHourlyRates();
    } else {
      setLoading(false); // If no session, stop loading and show no rates
      setError('Veuillez vous connecter pour gérer les paramètres.');
    }
  }, [session]); // Re-run when session changes

  const fetchHourlyRates = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('settings')
      .select('activity_type, hourly_rate')
      .eq('user_id', session.user.id); // Filter by user_id

    if (error) {
      console.error('Erreur lors du chargement des taux horaires:', error);
      setError('Impossible de charger les taux horaires.');
    } else {
      const rates = data.reduce((acc, setting) => {
        acc[setting.activity_type] = parseFloat(setting.hourly_rate);
        return acc;
      }, { garde: 0, astreinte: 0, intervention: 0 });
      setHourlyRates(rates);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setHourlyRates((prevRates) => ({
      ...prevRates,
      [name]: parseFloat(value) || 0,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage('');

    if (!session || !session.user) {
      setError('Vous devez être connecté pour sauvegarder les paramètres.');
      setLoading(false);
      return;
    }

    const updates = activityTypes.map(type => ({
      activity_type: type,
      hourly_rate: hourlyRates[type],
      user_id: session.user.id,
    }));

    const { error: upsertError } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'activity_type, user_id' });

    if (upsertError) {
      console.error('Erreur lors de la sauvegarde des paramètres:', upsertError);
      setError('Impossible de sauvegarder les paramètres.');
    } else {
      setMessage('Paramètres sauvegardés avec succès !');
      fetchHourlyRates();
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="loading-container">Chargement des paramètres...</div>;
  }

  return (
    <div className="settings-container">
      <h2>Paramètres des Taux Horaires</h2>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      {session?.user?.id ? (
        <form onSubmit={handleSubmit} className="settings-form">
          {activityTypes.map((type) => (
            <div className="form-group" key={type}>
              <label htmlFor={type}>Taux horaire pour {type.charAt(0).toUpperCase() + type.slice(1)} (€/heure):</label>
              <input
                type="number"
                id={type}
                name={type}
                value={hourlyRates[type]}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
              />
            </div>
          ))}
          <button type="submit">Sauvegarder les paramètres</button>
        </form>
      ) : (
        <p>Veuillez vous connecter pour accéder aux paramètres.</p>
      )}
    </div>
  );
}

Settings.propTypes = {
  session: PropTypes.object,
};

export default Settings;

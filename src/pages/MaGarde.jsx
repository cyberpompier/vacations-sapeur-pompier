import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './MaGarde.css';

function MaGarde({ session }) {
  const [isInterventionActive, setIsInterventionActive] = useState(false);
  const [currentInterventionId, setCurrentInterventionId] = useState(null);
  const [interventionStartTime, setInterventionStartTime] = useState(null);
  const [interventionsHistory, setInterventionsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing
  const [editingInterventionId, setEditingInterventionId] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  useEffect(() => {
    if (session) {
      fetchActiveIntervention();
      fetchInterventionHistory();
    }
  }, [session]);

  const fetchActiveIntervention = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('interventions')
        .select('id, start_time')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found (expected if no active intervention)
        throw error;
      }

      if (data) {
        setIsInterventionActive(true);
        setCurrentInterventionId(data.id);
        setInterventionStartTime(new Date(data.start_time));
      } else {
        setIsInterventionActive(false);
        setCurrentInterventionId(null);
        setInterventionStartTime(null);
      }
    } catch (err) {
      console.error('Error fetching active intervention:', err.message);
      setError('Erreur lors du chargement de l\'état de l\'intervention.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInterventionHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('interventions')
        .select('id, start_time, end_time')
        .eq('user_id', session.user.id)
        .eq('is_active', false) // Fetch only inactive (completed) interventions
        .order('start_time', { ascending: false }); // Order by most recent first

      if (error) {
        throw error;
      }

      setInterventionsHistory(data || []);
    } catch (err) {
      console.error('Error fetching intervention history:', err.message);
      setError('Erreur lors du chargement de l\'historique des interventions.');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartIntervention = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('interventions')
        .insert({
          user_id: session.user.id,
          start_time: new Date().toISOString(),
          is_active: true,
        })
        .select('id, start_time')
        .single();

      if (error) {
        throw error;
      }

      setIsInterventionActive(true);
      setCurrentInterventionId(data.id);
      setInterventionStartTime(new Date(data.start_time));
      alert('Départ en intervention enregistré !');
    } catch (err) {
      console.error('Error starting intervention:', err.message);
      setError('Erreur lors de l\'enregistrement du départ en intervention.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetourIntervention = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('interventions')
        .update({
          end_time: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', currentInterventionId)
        .eq('user_id', session.user.id); // Ensure user can only update their own

      if (error) {
        throw error;
      }

      setIsInterventionActive(false);
      setCurrentInterventionId(null);
      setInterventionStartTime(null);
      alert('Retour d\'intervention enregistré !');
      fetchInterventionHistory(); // Refresh history after completing an intervention
    } catch (err) {
      console.error('Error ending intervention:', err.message);
      setError('Erreur lors de l\'enregistrement du retour d\'intervention.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (start, end = new Date()) => {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;
    const diffSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // Helper to format date for datetime-local input
  const formatForDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEditClick = (intervention) => {
    setEditingInterventionId(intervention.id);
    setEditStartTime(formatForDateTimeLocal(intervention.start_time));
    setEditEndTime(intervention.end_time ? formatForDateTimeLocal(intervention.end_time) : '');
  };

  const handleCancelEdit = () => {
    setEditingInterventionId(null);
    setEditStartTime('');
    setEditEndTime('');
  };

  const handleSaveEdit = async (interventionId) => {
    setLoading(true);
    setError(null);
    try {
      // Convert local datetime-local strings to ISO strings for Supabase
      const updatedStartTime = editStartTime ? new Date(editStartTime).toISOString() : null;
      const updatedEndTime = editEndTime ? new Date(editEndTime).toISOString() : null;

      const { error } = await supabase
        .from('interventions')
        .update({
          start_time: updatedStartTime,
          end_time: updatedEndTime,
        })
        .eq('id', interventionId)
        .eq('user_id', session.user.id);

      if (error) {
        throw error;
      }

      alert('Intervention modifiée avec succès !');
      setEditingInterventionId(null);
      setEditStartTime('');
      setEditEndTime('');
      fetchInterventionHistory(); // Refresh history
    } catch (err) {
      console.error('Error saving intervention:', err.message);
      setError('Erreur lors de la modification de l\'intervention.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = async (interventionId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette intervention ?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('interventions')
        .delete()
        .eq('id', interventionId)
        .eq('user_id', session.user.id);

      if (error) {
        throw error;
      }

      alert('Intervention supprimée avec succès !');
      fetchInterventionHistory(); // Refresh history
    } catch (err) {
      console.error('Error deleting intervention:', err.message);
      setError('Erreur lors de la suppression de l\'intervention.');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div className="ma-garde-container">Veuillez vous connecter pour accéder à cette page.</div>;
  }

  return (
    <div className="ma-garde-container">
      <h2>Ma Garde</h2>
      <p>Bienvenue sur la page "Ma Garde" ! Gérez vos interventions ici.</p>

      {loading && <p>Chargement de l'état de l'intervention et de l'historique...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && (
        <>
          <div className="intervention-status">
            {isInterventionActive ? (
              <>
                <p className="status-active">
                  Vous êtes actuellement en intervention depuis le{' '}
                  {interventionStartTime && interventionStartTime.toLocaleString()}.
                </p>
                <p className="status-duration">Durée actuelle : {formatDuration(interventionStartTime)}</p>
              </>
            ) : (
              <p className="status-inactive">Vous n'êtes pas en intervention actuellement.</p>
            )}

            <div className="intervention-buttons">
              <button
                onClick={handleDepartIntervention}
                disabled={isInterventionActive || loading}
                className="button depart-button"
              >
                Départ en intervention
              </button>
              <button
                onClick={handleRetourIntervention}
                disabled={!isInterventionActive || loading}
                className="button retour-button"
              >
                Retour d'intervention
              </button>
            </div>
          </div>

          <div className="intervention-history">
            <h3>Historique des interventions</h3>
            {interventionsHistory.length > 0 ? (
              <ul className="history-list">
                {interventionsHistory.map((intervention) => (
                  <li key={intervention.id} className="history-item">
                    {editingInterventionId === intervention.id ? (
                      <div className="edit-form">
                        <label>
                          Départ:
                          <input
                            type="datetime-local"
                            value={editStartTime}
                            onChange={(e) => setEditStartTime(e.target.value)}
                          />
                        </label>
                        <label>
                          Retour:
                          <input
                            type="datetime-local"
                            value={editEndTime}
                            onChange={(e) => setEditEndTime(e.target.value)}
                          />
                        </label>
                        <div className="edit-actions">
                          <button onClick={() => handleSaveEdit(intervention.id)} className="button save-button">
                            Enregistrer
                          </button>
                          <button onClick={handleCancelEdit} className="button cancel-button">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>
                          Départ: <strong>{new Date(intervention.start_time).toLocaleString()}</strong>
                        </p>
                        <p>
                          Retour: <strong>{intervention.end_time ? new Date(intervention.end_time).toLocaleString() : 'En cours...'}</strong>
                        </p>
                        <p>
                          Durée: <strong>{formatDuration(intervention.start_time, intervention.end_time)}</strong>
                        </p>
                        <div className="history-actions">
                          <button onClick={() => handleEditClick(intervention)} className="button edit-button">
                            Modifier
                          </button>
                          <button onClick={() => handleDeleteClick(intervention.id)} className="button delete-button">
                            Supprimer
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune intervention passée à afficher.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

MaGarde.propTypes = {
  session: PropTypes.object,
};

export default MaGarde;

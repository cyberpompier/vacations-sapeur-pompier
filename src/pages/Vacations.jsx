import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { parseISO, format, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import PropTypes from 'prop-types';
import './Vacations.css';

function Vacations({ session }) { // Accept session as a prop
  const [vacations, setVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    activity_type: 'garde',
    start_time: '',
    end_time: '',
    notes: '',
  });
  const [editingVacationId, setEditingVacationId] = useState(null);
  const [hourlyRates, setHourlyRates] = useState({});

  const activityTypes = ['garde', 'astreinte', 'intervention'];

  useEffect(() => {
    if (session?.user?.id) { // Fetch data only if user is logged in
      fetchVacations();
      fetchHourlyRates();
    } else {
      setLoading(false);
      setError('Veuillez vous connecter pour gérer les vacations.');
    }
  }, [session]); // Re-run when session changes

  const fetchVacations = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('vacations')
      .select('*')
      .eq('user_id', session.user.id) // Filter by user_id
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Erreur lors du chargement des vacations:', error);
      setError('Impossible de charger les vacations.');
    } else {
      setVacations(data);
    }
    setLoading(false);
  };

  const fetchHourlyRates = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('activity_type, hourly_rate')
      .eq('user_id', session.user.id); // Filter by user_id

    if (error) {
      console.error('Erreur lors du chargement des taux horaires:', error);
      setHourlyRates({
        garde: 0,
        astreinte: 0,
        intervention: 0,
      });
    } else {
      const rates = data.reduce((acc, setting) => {
        acc[setting.activity_type] = parseFloat(setting.hourly_rate);
        return acc;
      }, {});
      setHourlyRates(rates);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const calculateDurationAndAmount = (start, end, type) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return { duration_minutes: 0, total_amount: 0 };
    }

    const durationMinutes = differenceInMinutes(endDate, startDate);
    const hours = durationMinutes / 60;
    const rate = hourlyRates[type] || 0;
    const totalAmount = hours * rate;

    return { duration_minutes: Math.round(durationMinutes), total_amount: parseFloat(totalAmount.toFixed(2)) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!session || !session.user) {
      setError('Vous devez être connecté pour sauvegarder une vacation.');
      setLoading(false);
      return;
    }

    const { duration_minutes, total_amount } = calculateDurationAndAmount(
      form.start_time,
      form.end_time,
      form.activity_type
    );

    if (duration_minutes <= 0) {
      setError('L\'heure de fin doit être postérieure à l\'heure de début.');
      setLoading(false);
      return;
    }

    const currentRate = hourlyRates[form.activity_type] || 0;

    const vacationData = {
      ...form,
      duration_minutes,
      hourly_rate_applied: currentRate,
      total_amount,
      user_id: session.user.id, // Use session from props
    };

    let response;
    if (editingVacationId) {
      response = await supabase
        .from('vacations')
        .update(vacationData)
        .eq('id', editingVacationId)
        .eq('user_id', session.user.id) // Ensure user can only update their own
        .select();
    } else {
      response = await supabase
        .from('vacations')
        .insert([vacationData])
        .select();
    }

    if (response.error) {
      console.error('Erreur lors de la sauvegarde de la vacation:', response.error);
      setError('Impossible de sauvegarder la vacation.');
    } else {
      setForm({
        activity_type: 'garde',
        start_time: '',
        end_time: '',
        notes: '',
      });
      setEditingVacationId(null);
      fetchVacations();
    }
    setLoading(false);
  };

  const handleEdit = (vacation) => {
    setEditingVacationId(vacation.id);
    setForm({
      activity_type: vacation.activity_type,
      start_time: format(parseISO(vacation.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(vacation.end_time), "yyyy-MM-dd'T'HH:mm"),
      notes: vacation.notes,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette vacation ?')) {
      return;
    }
    setLoading(true);
    setError(null);

    if (!session || !session.user) {
      setError('Vous devez être connecté pour supprimer une vacation.');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('vacations')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id); // Ensure user can only delete their own

    if (error) {
      console.error('Erreur lors de la suppression de la vacation:', error);
      setError('Impossible de supprimer la vacation.');
    } else {
      fetchVacations();
    }
    setLoading(false);
  };

  const getTotalSummary = () => {
    const summary = {
      totalHours: 0,
      totalAmount: 0,
      byActivity: {},
    };

    activityTypes.forEach(type => {
      summary.byActivity[type] = { hours: 0, amount: 0 };
    });

    vacations.forEach(vac => {
      const hours = vac.duration_minutes / 60;
      summary.totalHours += hours;
      summary.totalAmount += vac.total_amount;
      if (summary.byActivity[vac.activity_type]) {
        summary.byActivity[vac.activity_type].hours += hours;
        summary.byActivity[vac.activity_type].amount += vac.total_amount;
      }
    });

    return summary;
  };

  const summary = getTotalSummary();

  if (loading) {
    return <div className="loading-container">Chargement des vacations...</div>;
  }

  return (
    <div className="vacations-container">
      <h2>Gestion des Vacations</h2>

      {error && <p className="error-message">{error}</p>}

      {session?.user?.id ? (
        <>
          <form onSubmit={handleSubmit} className="vacation-form">
            <h3>{editingVacationId ? 'Modifier une vacation' : 'Ajouter une nouvelle vacation'}</h3>
            <div className="form-group">
              <label htmlFor="activity_type">Type d'activité:</label>
              <select
                id="activity_type"
                name="activity_type"
                value={form.activity_type}
                onChange={handleChange}
                required
              >
                {activityTypes.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="start_time">Heure de début:</label>
              <input
                type="datetime-local"
                id="start_time"
                name="start_time"
                value={form.start_time}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="end_time">Heure de fin:</label>
              <input
                type="datetime-local"
                id="end_time"
                name="end_time"
                value={form.end_time}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes">Notes:</label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
              ></textarea>
            </div>
            <button type="submit">{editingVacationId ? 'Mettre à jour' : 'Ajouter'}</button>
            {editingVacationId && (
              <button type="button" onClick={() => {
                setEditingVacationId(null);
                setForm({ activity_type: 'garde', start_time: '', end_time: '', notes: '' });
              }} className="cancel-button">Annuler</button>
            )}
          </form>

          <div className="summary-section">
            <h3>Résumé des Totaux</h3>
            <p>Total Heures: <strong>{summary.totalHours.toFixed(2)}h</strong></p>
            <p>Total Montant: <strong>{summary.totalAmount.toFixed(2)} €</strong></p>
            <h4>Par Activité:</h4>
            <ul>
              {activityTypes.map(type => (
                <li key={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}: {summary.byActivity[type].hours.toFixed(2)}h / {summary.byActivity[type].amount.toFixed(2)} €
                </li>
              ))}
            </ul>
          </div>

          <h3>Liste des Vacations</h3>
          {vacations.length === 0 ? (
            <p>Aucune vacation enregistrée pour le moment.</p>
          ) : (
            <ul className="vacations-list">
              {vacations.map((vac) => (
                <li key={vac.id} className="vacation-item">
                  <div className="vacation-details">
                    <strong>{vac.activity_type.charAt(0).toUpperCase() + vac.activity_type.slice(1)}</strong>
                    <p>Début: {format(parseISO(vac.start_time), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                    <p>Fin: {format(parseISO(vac.end_time), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                    <p>Durée: {(vac.duration_minutes / 60).toFixed(2)}h</p>
                    <p>Taux appliqué: {vac.hourly_rate_applied.toFixed(2)} €/h</p>
                    <p>Montant: {vac.total_amount.toFixed(2)} €</p>
                    {vac.notes && <p className="vacation-notes">Notes: {vac.notes}</p>}
                  </div>
                  <div className="vacation-actions">
                    <button onClick={() => handleEdit(vac)} className="edit-button">Modifier</button>
                    <button onClick={() => handleDelete(vac.id)} className="delete-button">Supprimer</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p>Veuillez vous connecter pour accéder à la gestion des vacations.</p>
      )}
    </div>
  );
}

Vacations.propTypes = {
  session: PropTypes.object,
};

export default Vacations;

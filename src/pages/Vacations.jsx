import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { parseISO, format, differenceInMinutes, startOfMonth, endOfMonth, startOfDay, endOfDay, setHours, setMinutes, addDays, isBefore, min, max } from 'date-fns';
import { fr } from 'date-fns/locale';
import PropTypes from 'prop-types';
import './Vacations.css';

function Vacations({ session }) {
  // vacations: Liste des vacations actuellement affichées (filtrées)
  const [vacations, setVacations] = useState([]);
  // allVacations: Liste complète de toutes les vacations récupérées de la base de données
  const [allVacations, setAllVacations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    activity_type: 'garde',
    start_time: '',
    end_time: '',
    notes: '',
  });
  const [editingVacationId, setEditingVacationId] = useState(null);
  // hourlyRates: Maintenant un objet simple { baseRate: X, garde: Y, astreinte: Z, intervention: W } pour le grade sélectionné de l'utilisateur
  const [hourlyRates, setHourlyRates] = useState({ baseRate: 0, garde: 0, astreinte: 0, intervention: 0 });
  // selectedMonth: État pour le mois sélectionné dans le filtre (format 'YYYY-MM' ou 'all')
  const [selectedMonth, setSelectedMonth] = useState('all');
  // availableMonths: Liste des mois uniques présents dans les vacations pour le sélecteur
  const [availableMonths, setAvailableMonths] = useState([]);

  // Création d'une référence pour le formulaire
  const formRef = useRef(null);

  const activityTypes = ['garde', 'astreinte', 'intervention'];

  // Effet pour récupérer toutes les vacations et les taux horaires au chargement du composant
  useEffect(() => {
    if (session?.user?.id) {
      fetchAllVacations();
      fetchUserHourlyRates(); // Appel de la nouvelle fonction pour les taux
    } else {
      setLoading(false);
      setError('Veuillez vous connecter pour gérer les vacations.');
    }
  }, [session]);

  // Effet pour filtrer les vacations et générer les mois disponibles lorsque allVacations ou selectedMonth changent
  useEffect(() => {
    if (allVacations.length > 0) {
      // 1. Générer les mois uniques pour le sélecteur de filtre
      const months = new Set();
      allVacations.forEach(vac => {
        const date = parseISO(vac.start_time);
        months.add(format(date, 'yyyy-MM'));
      });
      // Trier les mois du plus ancien au plus récent
      const sortedMonths = Array.from(months).sort((a, b) => new Date(a) - new Date(b));
      setAvailableMonths(sortedMonths);

      // 2. Filtrer les vacations pour l'affichage
      const filtered = allVacations.filter(vac => {
        if (selectedMonth === 'all') {
          return true; // Afficher toutes les vacations si 'all' est sélectionné
        }
        const vacDate = parseISO(vac.start_time);
        const [year, month] = selectedMonth.split('-').map(Number);
        // Comparer l'année et le mois de la vacation avec le mois sélectionné
        return vacDate.getFullYear() === year && (vacDate.getMonth() + 1) === month;
      });
      setVacations(filtered);
    } else {
      setVacations([]); // Aucune vacation à afficher si allVacations est vide
      setAvailableMonths([]);
    }
  }, [allVacations, selectedMonth]);

  // Fonction pour récupérer toutes les vacations de l'utilisateur
  const fetchAllVacations = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('vacations')
      .select('*')
      .eq('user_id', session.user.id)
      .order('start_time', { ascending: false }); // Ordonner par date de début

    if (error) {
      console.error('Erreur lors du chargement des vacations:', error);
      setError('Impossible de charger les vacations.');
      setAllVacations([]);
    } else {
      setAllVacations(data); // Stocker toutes les vacations
    }
    setLoading(false);
  };

  // Nouvelle fonction pour récupérer les taux horaires spécifiques au grade de l'utilisateur
  const fetchUserHourlyRates = async () => {
    if (!session?.user?.id) return;

    // 1. Récupérer le grade sélectionné par l'utilisateur
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('selected_grade')
      .eq('id', session.user.id)
      .single();

    let userGrade = 'Pompier'; // Grade par défaut si non trouvé
    if (profileData) {
      userGrade = profileData.selected_grade;
    } else if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erreur lors du chargement du profil utilisateur:', profileError);
      setError('Impossible de charger votre grade. Utilisation du grade par défaut.');
    }

    // 2. Récupérer TOUS les paramètres (taux de base et pourcentages) pour ce grade et cet utilisateur
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('activity_type, hourly_rate')
      .eq('user_id', session.user.id)
      .eq('grade', userGrade); // Filtrer par le grade de l'utilisateur

    if (settingsError) {
      console.error('Erreur lors du chargement des taux horaires pour le grade:', settingsError);
      setError('Impossible de charger les taux horaires pour votre grade. Veuillez vérifier les paramètres.');
      setHourlyRates({
        baseRate: 0,
        garde: 0,
        astreinte: 0,
        intervention: 0,
      });
    } else {
      const rates = { baseRate: 0, garde: 0, astreinte: 0, intervention: 0 };
      settingsData.forEach(setting => {
        if (setting.activity_type === 'base_rate') {
          rates.baseRate = parseFloat(setting.hourly_rate);
        } else {
          // Les autres activity_type sont des pourcentages
          rates[setting.activity_type] = parseFloat(setting.hourly_rate);
        }
      });
      setHourlyRates(rates);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Gère le changement de sélection du mois de filtre
  const handleMonthFilterChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const calculateDurationAndAmount = (start, end, type) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return { duration_minutes: 0, total_amount: 0, hourly_rate_applied: 0 };
    }

    const baseRate = hourlyRates.baseRate || 0;

    // Helper pour obtenir le taux horaire réel pour un type d'activité donné (garde ou astreinte)
    const getActualHourlyRate = (activityType) => {
      const percentage = hourlyRates[activityType] || 0;
      return baseRate * (percentage / 100);
    };

    if (type === 'garde') {
      let totalGardeAmount = 0;
      let totalGardeDurationMinutes = 0;

      // Définir les tranches horaires journalières et leurs types de taux correspondants
      // Ces tranches sont relatives au début d'une journée donnée (00:00)
      const dailySlots = [
        { start: { h: 0, m: 0 }, end: { h: 8, m: 0 }, rateType: 'astreinte' },
        { start: { h: 8, m: 0 }, end: { h: 12, m: 0 }, rateType: 'garde' },
        { start: { h: 12, m: 0 }, end: { h: 13, m: 30 }, rateType: 'astreinte' },
        { start: { h: 13, m: 30 }, end: { h: 17, m: 30 }, rateType: 'garde' },
        { start: { h: 17, m: 30 }, end: { h: 24, m: 0 }, rateType: 'astreinte' }, // 24:00 est la fin de la journée
      ];

      let currentProcessingTime = startDate;

      // Boucle tant que le temps de traitement actuel est avant la date de fin de la vacation
      while (isBefore(currentProcessingTime, endDate)) {
        // Déterminer la fin de la journée actuelle ou la fin de la vacation, selon ce qui arrive en premier
        const endOfCurrentDay = endOfDay(currentProcessingTime);
        const segmentEnd = min([endDate, endOfCurrentDay]);

        // Itérer à travers les tranches horaires journalières
        for (const slot of dailySlots) {
          // Calculer les heures de début et de fin réelles pour cette tranche sur la journée actuelle
          let slotStartOnDay = setMinutes(setHours(startOfDay(currentProcessingTime), slot.start.h), slot.start.m);
          let slotEndOnDay = setMinutes(setHours(startOfDay(currentProcessingTime), slot.end.h), slot.end.m);

          // Gérer le cas 24:00 pour la fin de journée (qui est 00:00 du jour suivant)
          if (slot.end.h === 24) {
            slotEndOnDay = addDays(startOfDay(currentProcessingTime), 1);
          }

          // Calculer l'intersection de la période de la vacation et de la tranche horaire actuelle
          const intersectionStart = max([currentProcessingTime, slotStartOnDay]);
          const intersectionEnd = min([segmentEnd, slotEndOnDay]);

          // Si l'intersection est valide (début avant la fin)
          if (isBefore(intersectionStart, intersectionEnd)) {
            const duration = differenceInMinutes(intersectionEnd, intersectionStart);
            if (duration > 0) {
              const rate = getActualHourlyRate(slot.rateType);
              totalGardeAmount += (duration / 60) * rate;
              totalGardeDurationMinutes += duration;
            }
          }
        }
        // Passer au début du jour suivant pour la prochaine itération
        currentProcessingTime = addDays(startOfDay(currentProcessingTime), 1);
      }

      // Calculer le taux horaire moyen appliqué pour l'affichage
      const averageHourlyRate = totalGardeDurationMinutes > 0 ? totalGardeAmount / (totalGardeDurationMinutes / 60) : 0;

      return {
        duration_minutes: Math.round(totalGardeDurationMinutes),
        total_amount: parseFloat(totalGardeAmount.toFixed(2)),
        hourly_rate_applied: parseFloat(averageHourlyRate.toFixed(2))
      };

    } else {
      // Logique existante pour les autres types d'activités
      const durationMinutes = differenceInMinutes(endDate, startDate);
      const hours = durationMinutes / 60;

      const percentage = hourlyRates[type] || 0;
      const actualHourlyRate = baseRate * (percentage / 100);

      const totalAmount = hours * actualHourlyRate;

      return {
        duration_minutes: Math.round(durationMinutes),
        total_amount: parseFloat(totalAmount.toFixed(2)),
        hourly_rate_applied: parseFloat(actualHourlyRate.toFixed(2))
      };
    }
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

    // Créer des objets Date à partir des chaînes datetime-local (qui sont en heure locale)
    const startDateTimeLocal = new Date(form.start_time);
    const endDateTimeLocal = new Date(form.end_time);

    // Valider les dates
    if (isNaN(startDateTimeLocal.getTime()) || isNaN(endDateTimeLocal.getTime()) || endDateTimeLocal <= startDateTimeLocal) {
      setError('L\'heure de fin doit être postérieure à l\'heure de début et les dates doivent être valides.');
      setLoading(false);
      return;
    }

    // Calculer la durée et le montant en utilisant les valeurs originales du formulaire (chaînes d'heure locale)
    // La fonction calculateDurationAndAmount interprète correctement 'YYYY-MM-DDTHH:mm' comme heure locale.
    const { duration_minutes, total_amount, hourly_rate_applied } = calculateDurationAndAmount(
      form.start_time, // Passer la chaîne d'heure locale originale pour le calcul
      form.end_time,   // Passer la chaîne d'heure locale originale pour le calcul
      form.activity_type
    );

    // Préparer les données pour Supabase : convertir les objets Date locaux en chaînes ISO UTC
    const vacationData = {
      ...form,
      start_time: startDateTimeLocal.toISOString(), // Convertir en chaîne ISO UTC pour la base de données
      end_time: endDateTimeLocal.toISOString(),     // Convertir en chaîne ISO UTC pour la base de données
      duration_minutes,
      hourly_rate_applied,
      total_amount,
      user_id: session.user.id,
    };

    let response;
    if (editingVacationId) {
      response = await supabase
        .from('vacations')
        .update(vacationData)
        .eq('id', editingVacationId)
        .eq('user_id', session.user.id)
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
      fetchAllVacations(); // Re-fetch all vacations to update the list and filter
    }
    setLoading(false);
  };

  const handleEdit = (vacation) => {
    setEditingVacationId(vacation.id);
    // Lors de l'édition, vacation.start_time et vacation.end_time sont des chaînes ISO UTC de la DB.
    // parseISO les convertit en objets Date UTC, et format les affiche dans le fuseau horaire local
    // pour correspondre au format attendu par l'input datetime-local.
    setForm({
      activity_type: vacation.activity_type,
      start_time: format(parseISO(vacation.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(vacation.end_time), "yyyy-MM-dd'T'HH:mm"),
      notes: vacation.notes,
    });
    // Faire défiler le formulaire dans la vue
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Erreur lors de la suppression de la vacation:', error);
      setError('Impossible de supprimer la vacation.');
    } else {
      fetchAllVacations(); // Re-fetch all vacations to update the list and filter
    }
    setLoading(false);
  };

  // Le résumé des totaux est maintenant basé sur la liste 'vacations' (filtrée)
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
      

      {error && <p className="error-message">{error}</p>}

      {session?.user?.id ? (
        <>
          {/* Ajout de la référence au formulaire */}
          <form onSubmit={handleSubmit} className="vacation-form" ref={formRef}>
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

          {/* Nouveau sélecteur de filtre par mois */}
          <div className="filter-section">
            <label htmlFor="month-filter">Filtrer par mois:</label>
            <select
              id="month-filter"
              value={selectedMonth}
              onChange={handleMonthFilterChange}
            >
              <option value="all">Tous les mois</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: fr })}
                </option>
              ))}
            </select>
          </div>

          <h3>Liste des Vacations</h3>
          {vacations.length === 0 ? (
            <p>Aucune vacation enregistrée pour le moment {selectedMonth !== 'all' ? `pour le mois de ${format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: fr })}` : ''}.</p>
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

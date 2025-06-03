import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { parseISO, format, differenceInMinutes, startOfMonth, endOfMonth, startOfDay, endOfDay, setHours, setMinutes, addDays, isBefore, min, max, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';
import PropTypes from 'prop-types';
import './Vacations.css';

// Helper function to subtract an exclusion interval from a list of periods
// periods: [{ start: Date, end: Date }]
// exclusionStart: Date, exclusionEnd: Date
const subtractIntervals = (periods, exclusionStart, exclusionEnd) => {
  const newPeriods = [];
  periods.forEach(period => {
    // Case 1: No overlap (period is entirely before or entirely after exclusion)
    // If the period ends before the exclusion starts, OR the period starts after the exclusion ends,
    // then there is no overlap, and the period is kept as is.
    if (isBefore(period.end, exclusionStart) || isAfter(period.start, exclusionEnd)) {
      newPeriods.push(period);
      return;
    }

    // Case 2: Exclusion completely covers the period
    // If the exclusion starts before or at the period start, AND ends after or at the period end,
    // then the period is completely removed.
    if (isBefore(exclusionStart, period.start) && isAfter(exclusionEnd, period.end)) {
      return; // Period is completely removed
    }

    // Case 3: Partial overlap, need to split the period
    // Part before the exclusion
    if (isBefore(period.start, exclusionStart)) {
      const newEnd = min([period.end, exclusionStart]);
      if (isBefore(period.start, newEnd)) { // Ensure valid interval
        newPeriods.push({ start: period.start, end: newEnd });
      }
    }

    // Part after the exclusion
    if (isAfter(period.end, exclusionEnd)) {
      const newStart = max([period.start, exclusionEnd]);
      if (isBefore(newStart, period.end)) { // Ensure valid interval
        newPeriods.push({ start: newStart, end: period.end });
      }
    }
  });
  return newPeriods;
};

// Helper function to calculate duration and amount for a single garde segment
const calculateGardeSegment = (segmentStart, segmentEnd, dailySlots, getActualHourlyRate) => {
  let segmentDurationMinutes = 0;
  let segmentAmount = 0;

  let currentProcessingTime = segmentStart;

  while (isBefore(currentProcessingTime, segmentEnd)) {
    const endOfCurrentDay = endOfDay(currentProcessingTime);
    const dailySegmentEnd = min([segmentEnd, endOfCurrentDay]);

    for (const slot of dailySlots) {
      let slotStartOnDay = setMinutes(setHours(startOfDay(currentProcessingTime), slot.start.h), slot.start.m);
      let slotEndOnDay = setMinutes(setHours(startOfDay(currentProcessingTime), slot.end.h), slot.end.m);

      if (slot.end.h === 24) {
        slotEndOnDay = addDays(startOfDay(currentProcessingTime), 1);
      }

      const intersectionStart = max([currentProcessingTime, slotStartOnDay]);
      const intersectionEnd = min([dailySegmentEnd, slotEndOnDay]);

      if (isBefore(intersectionStart, intersectionEnd)) {
        const duration = differenceInMinutes(intersectionEnd, intersectionStart);
        if (duration > 0) {
          const rate = getActualHourlyRate(slot.rateType);
          segmentAmount += (duration / 60) * rate;
          segmentDurationMinutes += duration;
        }
      }
    }
    currentProcessingTime = addDays(startOfDay(currentProcessingTime), 1);
  }
  return { duration: segmentDurationMinutes, amount: segmentAmount };
};

// Helper function to calculate duration and amount for a single intervention
const calculateInterventionDetails = (start, end, hourlyRates) => {
  // Ensure start and end are valid non-empty strings before parsing
  if (typeof start !== 'string' || start.trim() === '' || typeof end !== 'string' || end.trim() === '') {
    return { duration_minutes: 0, total_amount: 0, hourly_rate_applied: 0 };
  }

  const startDate = parseISO(start);
  const endDate = parseISO(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
    return { duration_minutes: 0, total_amount: 0, hourly_rate_applied: 0 };
  }

  const durationMinutes = differenceInMinutes(endDate, startDate);
  const hours = durationMinutes / 60;

  const baseRate = hourlyRates.baseRate || 0;
  const percentage = hourlyRates.intervention || 0; // Use 'intervention' rate
  const actualHourlyRate = baseRate * (percentage / 100);

  const totalAmount = hours * actualHourlyRate;

  return {
    duration_minutes: Math.round(durationMinutes),
    total_amount: parseFloat(totalAmount.toFixed(2)),
    hourly_rate_applied: parseFloat(actualHourlyRate.toFixed(2)),
  };
};


function Vacations({ session }) {
  // vacations: Liste des vacations actuellement affichées (filtrées)
  const [vacations, setVacations] = useState([]);
  // allVacations: Liste complète de toutes les vacations récupérées de la base de données
  const [allVacations, setAllVacations] = useState([]);
  // allInterventions: Liste complète de toutes les interventions terminées de la base de données
  const [allInterventions, setAllInterventions] = useState([]);
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
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        await fetchUserHourlyRates(); // Rates needed for calculation
        await fetchAllInterventions(); // Interventions needed for calculation
        // fetchAllVacations will be called after interventions are fetched
        // to ensure correct recalculation of garde durations
        setLoading(false);
      };
      fetchData();
    } else {
      setLoading(false);
      setError('Veuillez vous connecter pour gérer les vacations.');
    }
  }, [session]);

  // Effet pour re-fetch les vacations une fois que allInterventions est mis à jour
  // Ceci est crucial pour que les vacations de type 'garde' soient recalculées avec les dernières interventions
  useEffect(() => {
    if (session?.user?.id && allInterventions.length > 0 || (session?.user?.id && allInterventions.length === 0 && !loading)) {
      // Only fetch vacations if interventions are loaded or confirmed empty
      fetchAllVacations();
    }
  }, [allInterventions, session]); // Depend on allInterventions and session

  // Effet pour filtrer les vacations et générer les mois disponibles lorsque allVacations ou selectedMonth changent
  useEffect(() => {
    if (allVacations.length > 0) {
      // 1. Générer les mois uniques pour le sélecteur de filtre
      const months = new Set();
      allVacations.forEach(vac => {
        // Ensure vac.start_time is not null/undefined or empty string before parsing
        if (typeof vac.start_time === 'string' && vac.start_time.trim() !== '') {
          const date = parseISO(vac.start_time);
          if (!isNaN(date.getTime())) { // Ensure parsed date is valid
            months.add(format(date, 'yyyy-MM'));
          }
        }
      });
      // Trier les mois du plus ancien au plus récent
      const sortedMonths = Array.from(months).sort((a, b) => new Date(a) - new Date(b));
      setAvailableMonths(sortedMonths);

      // 2. Filtrer les vacations pour l'affichage
      const filtered = allVacations.filter(vac => {
        if (selectedMonth === 'all') {
          return true; // Afficher toutes les vacations si 'all' est sélectionné
        }
        // Ensure vac.start_time is not null/undefined or empty string before parsing
        if (typeof vac.start_time !== 'string' || vac.start_time.trim() === '') {
          return false;
        }
        const vacDate = parseISO(vac.start_time);
        if (isNaN(vacDate.getTime())) { // Ensure parsed date is valid
          return false;
        }
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
    // setLoading(true) and setError(null) are handled by the useEffect wrapper
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
      // Re-calculate duration and amount for 'garde' vacations based on current interventions
      const processedVacations = await Promise.all(data.map(async (vac) => {
        let processedVac = { ...vac };

        if (vac.activity_type === 'garde') {
          // Ensure allInterventions is available here.
          // This is why fetchAllInterventions must complete before this.
          const { duration_minutes, total_amount, hourly_rate_applied, intervention_count } = calculateDurationAndAmount(
            vac.start_time,
            vac.end_time,
            vac.activity_type,
            allInterventions // Pass the state here
          );
          processedVac = {
            ...processedVac,
            duration_minutes,
            total_amount,
            hourly_rate_applied,
            intervention_count, // Add the new count
          };

          // --- NEW LOGIC FOR OVERLAPPING USERS ---
          const vacStartTime = typeof vac.start_time === 'string' && vac.start_time.trim() !== '' ? parseISO(vac.start_time) : null;
          const vacEndTime = typeof vac.end_time === 'string' && vac.end_time.trim() !== '' ? parseISO(vac.end_time) : null;

          if (vacStartTime && vacEndTime && !isNaN(vacStartTime.getTime()) && !isNaN(vacEndTime.getTime())) {
            console.log('Checking for overlapping vacations for:', vac.id, 'from', vac.start_time, 'to', vac.end_time);
            const { data: overlappingVacations, error: overlapError } = await supabase
              .from('vacations')
              .select('user_id')
              .neq('user_id', session.user.id) // Exclude current user
              .eq('activity_type', 'garde') // Only other 'garde' activities
              .filter('start_time', 'lt', vac.end_time) // Starts before current vac ends
              .filter('end_time', 'gt', vac.start_time); // Ends after current vac starts

            if (overlapError) {
              console.error('Error fetching overlapping vacations:', overlapError);
              processedVac.overlapping_users = []; // Default to empty
            } else {
              console.log('Raw overlapping vacations data:', overlappingVacations);
              const uniqueUserIds = [...new Set(overlappingVacations.map(ov => ov.user_id))];
              console.log('Unique overlapping user IDs:', uniqueUserIds);

              if (uniqueUserIds.length > 0) {
                const { data: overlappingProfiles, error: profilesError } = await supabase
                  .from('profiles')
                  .select('id, nom, prenom, photo_url') // Changed 'username' to 'nom, prenom'
                  .in('id', uniqueUserIds);

                if (profilesError) {
                  console.error('Error fetching overlapping profiles:', profilesError);
                  processedVac.overlapping_users = [];
                } else {
                  console.log('Overlapping profiles data:', overlappingProfiles);
                  processedVac.overlapping_users = overlappingProfiles || [];
                }
              } else {
                processedVac.overlapping_users = [];
              }
            }
          } else {
            processedVac.overlapping_users = []; // Invalid date, no overlapping users
            console.warn('Invalid start_time or end_time for vacation, skipping overlapping user check:', vac.id, vac.start_time, vac.end_time);
          }
        }
        console.log('Processed vacation with overlapping users:', processedVac);
        return processedVac;
      }));
      setAllVacations(processedVacations); // Stocker toutes les vacations (potentiellement recalculées)
    }
  };

  // Nouvelle fonction pour récupérer toutes les interventions terminées de l'utilisateur
  const fetchAllInterventions = async () => {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('interventions')
      .select('id, start_time, end_time')
      .eq('user_id', session.user.id)
      .eq('is_active', false); // Only completed interventions affect garde calculations

    if (error) {
      console.error('Erreur lors du chargement des interventions:', error);
      setError('Impossible de charger les interventions pour le calcul des gardes.');
      setAllInterventions([]);
    } else {
      setAllInterventions(data || []);
    }
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

  const calculateDurationAndAmount = (start, end, type, interventionsData) => {
    // Ensure start and end are valid non-empty strings before parsing
    if (typeof start !== 'string' || start.trim() === '' || typeof end !== 'string' || end.trim() === '') {
      return { duration_minutes: 0, total_amount: 0, hourly_rate_applied: 0, intervention_count: 0 };
    }

    const startDate = parseISO(start);
    const endDate = parseISO(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return { duration_minutes: 0, total_amount: 0, hourly_rate_applied: 0, intervention_count: 0 };
    }

    const baseRate = hourlyRates.baseRate || 0;

    let intervention_count = 0; // Declare intervention_count here

    // Helper pour obtenir le taux horaire réel pour un type d'activité donné (garde ou astreinte)
    const getActualHourlyRate = (activityType) => {
      const percentage = hourlyRates[activityType] || 0;
      return baseRate * (percentage / 100);
    };

    if (type === 'garde') {
      const fullGardeDurationMinutes = differenceInMinutes(endDate, startDate); // Durée totale de la garde
      let totalAmount = 0;
      
      // Définir les tranches horaires journalières et leurs types de taux correspondants
      const dailySlots = [
        { start: { h: 0, m: 0 }, end: { h: 8, m: 0 }, rateType: 'astreinte' },
        { start: { h: 8, m: 0 }, end: { h: 12, m: 0 }, rateType: 'garde' },
        { start: { h: 12, m: 0 }, end: { h: 13, m: 30 }, rateType: 'astreinte' },
        { start: { h: 13, m: 30 }, end: { h: 17, m: 30 }, rateType: 'garde' },
        { start: { h: 17, m: 30 }, end: { h: 24, m: 0 }, rateType: 'astreinte' },
      ];

      // 1. Identifier les interventions pertinentes qui chevauchent la période de garde
      const relevantInterventions = interventionsData.filter(int => {
        // Ensure both start_time and end_time are valid non-empty strings before parsing
        if (typeof int.start_time !== 'string' || int.start_time.trim() === '' ||
            typeof int.end_time !== 'string' || int.end_time.trim() === '') {
          return false; // Skip this intervention if times are missing or empty
        }
        const intStart = parseISO(int.start_time);
        const intEnd = parseISO(int.end_time);
        // Also ensure parsed dates are valid Date objects
        if (isNaN(intStart.getTime()) || isNaN(intEnd.getTime())) {
          return false; // Skip if parsed dates are invalid
        }
        return isBefore(intStart, endDate) && isAfter(intEnd, startDate);
      });

      intervention_count = relevantInterventions.length; 

      // 2. Calculer le montant pour les périodes de garde/astreinte NON couvertes par les interventions
      let effectiveGardePeriods = [{ start: startDate, end: endDate }];
      relevantInterventions.forEach(intervention => {
        const iStart = parseISO(intervention.start_time);
        const iEnd = parseISO(intervention.end_time);
        effectiveGardePeriods = subtractIntervals(effectiveGardePeriods, iStart, iEnd);
      });

      effectiveGardePeriods.forEach(period => {
        const { amount } = calculateGardeSegment(period.start, period.end, dailySlots, getActualHourlyRate);
        totalAmount += amount; // Montant pour les parties de garde/astreinte non-intervention
      });

      // 3. Calculer le montant pour les périodes d'intervention
      const interventionRate = getActualHourlyRate('intervention');
      relevantInterventions.forEach(intervention => {
        const iStart = parseISO(intervention.start_time);
        const iEnd = parseISO(intervention.end_time);

        // Calculer le chevauchement réel de l'intervention avec la période de garde
        const overlapStart = max([startDate, iStart]);
        const overlapEnd = min([endDate, iEnd]);

        if (isBefore(overlapStart, overlapEnd)) {
          const duration = differenceInMinutes(overlapEnd, overlapStart);
          if (duration > 0) {
            totalAmount += (duration / 60) * interventionRate; // Ajouter le montant pour la partie intervention
          }
        }
      });

      // Calculer le taux horaire moyen appliqué pour l'affichage
      const averageHourlyRate = fullGardeDurationMinutes > 0 ? totalAmount / (fullGardeDurationMinutes / 60) : 0;

      return {
        duration_minutes: Math.round(fullGardeDurationMinutes), // Durée totale de la garde
        total_amount: parseFloat(totalAmount.toFixed(2)), // Montant total incluant les interventions
        hourly_rate_applied: parseFloat(averageHourlyRate.toFixed(2)),
        intervention_count, 
      };

    } else {
      // Logique existante pour les autres types d'activités (astreinte, intervention)
      const durationMinutes = differenceInMinutes(endDate, startDate);
      const hours = durationMinutes / 60;

      const percentage = hourlyRates[type] || 0;
      const actualHourlyRate = baseRate * (percentage / 100);

      const totalAmount = hours * actualHourlyRate;

      return {
        duration_minutes: Math.round(durationMinutes),
        total_amount: parseFloat(totalAmount.toFixed(2)),
        hourly_rate_applied: parseFloat(actualHourlyRate.toFixed(2)),
        intervention_count: intervention_count, // Use the declared variable
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
    const { duration_minutes, total_amount, hourly_rate_applied, intervention_count } = calculateDurationAndAmount(
      form.start_time, // Passer la chaîne d'heure locale originale pour le calcul
      form.end_time,   // Passer la chaîne d'heure locale originale pour le calcul
      form.activity_type,
      allInterventions // Pass allInterventions for calculation
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
      intervention_count, // Inclure le nombre d'interventions
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
      summary.byActivity[type] = { hours: 0, amount: 0, count: 0 };
    });

    // Calculate for 'garde' and 'astreinte' from vacations
    vacations.forEach(vac => {
      if (vac.activity_type === 'garde' || vac.activity_type === 'astreinte') {
        const hours = vac.duration_minutes / 60;
        summary.byActivity[vac.activity_type].hours += hours;
        summary.byActivity[vac.activity_type].amount += vac.total_amount;
      }
    });

    // Calculate for 'intervention' from allInterventions (completed ones)
    let interventionTotalHours = 0;
    let interventionTotalAmount = 0;
    let interventionCount = 0;

    // Filter interventions by selected month
    const filteredInterventions = allInterventions.filter(int => {
      if (selectedMonth === 'all') {
        return true;
      }
      // Ensure int.start_time is not null/undefined or empty string before parsing
      if (typeof int.start_time !== 'string' || int.start_time.trim() === '') {
        return false;
      }
      const intDate = parseISO(int.start_time);
      if (isNaN(intDate.getTime())) { // Ensure parsed date is valid
        return false;
      }
      const [year, month] = selectedMonth.split('-').map(Number);
      return intDate.getFullYear() === year && (intDate.getMonth() + 1) === month;
    });

    filteredInterventions.forEach(int => {
      // Ensure both start_time and end_time exist and are valid strings before calling calculateInterventionDetails
      if (typeof int.start_time === 'string' && int.start_time.trim() !== '' && 
          typeof int.end_time === 'string' && int.end_time.trim() !== '') { 
        const { duration_minutes, total_amount } = calculateInterventionDetails(
          int.start_time,
          int.end_time,
          hourlyRates
        );
        interventionTotalHours += duration_minutes / 60;
        interventionTotalAmount += total_amount;
        interventionCount++;
      }
    });

    summary.byActivity.intervention.hours = interventionTotalHours;
    summary.byActivity.intervention.amount = interventionTotalAmount;
    summary.byActivity.intervention.count = interventionCount;

    // Calculate overall totals by summing up the individual activity totals
    summary.totalHours = summary.byActivity.garde.hours + summary.byActivity.astreinte.hours + summary.byActivity.intervention.hours;
    summary.totalAmount = summary.byActivity.garde.amount + summary.byActivity.astreinte.amount + summary.byActivity.intervention.amount;

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
                  {type === 'intervention' && ` (${summary.byActivity[type].count} interventions)`}
                </li>
              ))}
            </ul>
            {/* Nouveau sélecteur de filtre par mois déplacé ici */}
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
										<p>Nombre d'interventions: <b>{vac.intervention_count}</b></p>
                    {vac.notes && <p className="vacation-notes">Notes: {vac.notes}</p>}
                    
                    {vac.activity_type === 'garde' && vac.overlapping_users && vac.overlapping_users.length > 0 && (
                      <div className="overlapping-users">
                        <p>Autres sapeurs en garde sur cette période :</p>
                        <div className="avatar-bubbles">
                          {vac.overlapping_users.map(user => (
                            <div key={user.id} className="avatar-bubble" title={`${user.prenom} ${user.nom}`}>
                              {user.photo_url ? (
                                <img src={user.photo_url} alt={`${user.prenom} ${user.nom}`} />
                              ) : (
                                <div className="avatar-placeholder">
                                  {user.prenom ? user.prenom.charAt(0).toUpperCase() : ''}
                                  {user.nom ? user.nom.charAt(0).toUpperCase() : ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

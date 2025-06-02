import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import PropTypes from 'prop-types';
import './Settings.css';

function Settings({ session }) {
  // hourlyRates: Stocke les taux horaires par grade et par type d'activité
  // Exemple: { 'Pompier': { base_rate: 20, garde: 100, astreinte: 50, intervention: 150 }, 'Caporal': { ... } }
  const [hourlyRates, setHourlyRates] = useState({});
  // allGrades: Liste de tous les grades pour lesquels des taux sont définis
  const [allGrades, setAllGrades] = useState([]);
  // userSelectedGrade: Le grade que l'utilisateur a choisi pour lui-même
  const [userSelectedGrade, setUserSelectedGrade] = useState('');
  // newGradeName: Pour le champ d'ajout d'un nouveau grade
  const [newGradeName, setNewGradeName] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  // Types d'activités qui auront un pourcentage
  const activityTypes = ['garde', 'astreinte', 'intervention'];
  // Types de taux à gérer (taux de base + pourcentages d'activités)
  const rateTypes = ['base_rate', ...activityTypes];

  useEffect(() => {
    if (session?.user?.id) {
      fetchSettingsAndProfile();
    } else {
      setLoading(false);
      setError('Veuillez vous connecter pour gérer les paramètres.');
    }
  }, [session]);

  // Fonction pour récupérer les paramètres (taux par grade) et le profil de l'utilisateur (grade sélectionné)
  const fetchSettingsAndProfile = async () => {
    setLoading(true);
    setError(null);

    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    // 1. Récupérer les taux horaires par grade (base_rate et pourcentages)
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('grade, activity_type, hourly_rate')
      .eq('user_id', session.user.id);

    if (settingsError) {
      console.error('Erreur lors du chargement des taux horaires:', settingsError);
      setError('Impossible de charger les taux horaires.');
    } else {
      const ratesByGrade = {};
      const gradesSet = new Set();
      settingsData.forEach(setting => {
        if (!ratesByGrade[setting.grade]) {
          // Initialiser avec des valeurs par défaut: base_rate à 0, pourcentages à 100
          ratesByGrade[setting.grade] = { base_rate: 0, garde: 100, astreinte: 100, intervention: 100 };
        }
        // Assigner la valeur récupérée (qui peut être un taux de base ou un pourcentage)
        ratesByGrade[setting.grade][setting.activity_type] = parseFloat(setting.hourly_rate);
        gradesSet.add(setting.grade);
      });

      // Assurer que les grades par défaut sont toujours présents si aucun n'est défini
      if (gradesSet.size === 0) {
        gradesSet.add('Pompier'); // Grade par défaut
        ratesByGrade['Pompier'] = { base_rate: 0, garde: 100, astreinte: 100, intervention: 100 };
      }

      const sortedGrades = Array.from(gradesSet).sort();
      setAllGrades(sortedGrades);
      setHourlyRates(ratesByGrade);
    }

    // 2. Récupérer le grade sélectionné par l'utilisateur
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('selected_grade')
      .eq('id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erreur lors du chargement du profil utilisateur:', profileError);
      // Ne pas définir d'erreur bloquante ici, juste un avertissement
    } else if (profileData) {
      setUserSelectedGrade(profileData.selected_grade);
    } else {
      // Si aucun profil n'existe, créer un profil par défaut
      const { error: insertProfileError } = await supabase
        .from('profiles')
        .insert({ id: session.user.id, selected_grade: 'Pompier' });
      if (insertProfileError) {
        console.error('Erreur lors de la création du profil par défaut:', insertProfileError);
      } else {
        setUserSelectedGrade('Pompier');
      }
    }

    setLoading(false);
  };

  // Gère le changement des taux (base ou pourcentage) pour un grade et un type spécifique
  const handleRateChange = (grade, type, value) => {
    setHourlyRates(prevRates => ({
      ...prevRates,
      [grade]: {
        ...prevRates[grade],
        [type]: parseFloat(value) || 0,
      },
    }));
  };

  // Gère le changement du nom du nouveau grade à ajouter
  const handleNewGradeNameChange = (e) => {
    setNewGradeName(e.target.value);
  };

  // Ajoute un nouveau grade à la liste des grades gérés
  const handleAddGrade = () => {
    if (newGradeName.trim() === '') {
      setError('Le nom du grade ne peut pas être vide.');
      return;
    }
    if (allGrades.includes(newGradeName.trim())) {
      setError('Ce grade existe déjà.');
      return;
    }

    const gradeToAdd = newGradeName.trim();
    setAllGrades(prevGrades => [...prevGrades, gradeToAdd].sort());
    setHourlyRates(prevRates => ({
      ...prevRates,
      // Initialiser le nouveau grade avec un taux de base de 0 et des pourcentages de 100
      [gradeToAdd]: { base_rate: 0, garde: 100, astreinte: 100, intervention: 100 },
    }));
    setNewGradeName('');
    setMessage(`Grade "${gradeToAdd}" ajouté. N'oubliez pas de sauvegarder les taux.`);
    setError(null);
  };

  // Gère la soumission du formulaire pour sauvegarder tous les taux horaires par grade
  const handleSubmitRates = async (e) => {
    e.preventDefault();
    console.log('handleSubmitRates appelé'); // Log de début de fonction
    setLoading(true);
    setError(null);
    setMessage('');

    if (!session || !session.user) {
      console.log('Session ou utilisateur non trouvé, retour.'); // Log si pas de session
      setError('Vous devez être connecté pour sauvegarder les paramètres.');
      setLoading(false);
      return;
    }

    const updates = [];
    allGrades.forEach(grade => {
      // Ajouter l'entrée pour le taux de base du grade
      updates.push({
        user_id: session.user.id,
        grade: grade,
        activity_type: 'base_rate', // Type d'activité spécifique pour le taux de base
        hourly_rate: hourlyRates[grade]?.base_rate || 0,
      });
      // Ajouter les entrées pour les pourcentages de chaque type d'activité
      activityTypes.forEach(type => {
        updates.push({
          user_id: session.user.id,
          grade: grade,
          activity_type: type, // 'garde', 'astreinte', 'intervention'
          hourly_rate: hourlyRates[grade]?.[type] || 0, // C'est le pourcentage
        });
      });
    });
    console.log('Payload des mises à jour:', updates); // Log du tableau de données à envoyer

    // Utilisation de upsert avec la contrainte onConflict pour mettre à jour ou insérer
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'user_id, activity_type, grade' });

    if (upsertError) {
      console.error('Erreur lors de la sauvegarde des paramètres:', upsertError); // Log d'erreur Supabase
      setError('Impossible de sauvegarder les paramètres.');
    } else {
      console.log('Paramètres sauvegardés avec succès!'); // Log de succès Supabase
      setMessage('Paramètres des taux horaires sauvegardés avec succès !');
      fetchSettingsAndProfile(); // Re-fetch pour s'assurer de la cohérence
    }
    setLoading(false);
    console.log('handleSubmitRates terminé.'); // Log de fin de fonction
  };

  // Gère le changement du grade sélectionné par l'utilisateur
  const handleUserGradeSelection = async (e) => {
    const newSelectedGrade = e.target.value;
    setUserSelectedGrade(newSelectedGrade);
    setLoading(true);
    setError(null);
    setMessage('');

    if (!session || !session.user) {
      setError('Vous devez être connecté pour modifier votre grade.');
      setLoading(false);
      return;
    }

    // Upsert le grade sélectionné dans la table profiles
    const { error: profileUpsertError } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, selected_grade: newSelectedGrade }, { onConflict: 'id' });

    if (profileUpsertError) {
      console.error('Erreur lors de la sauvegarde du grade sélectionné:', profileUpsertError);
      setError('Impossible de sauvegarder votre grade sélectionné.');
    } else {
      setMessage('Votre grade a été mis à jour avec succès !');
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
        <>
          {/* Section pour le grade actuel de l'utilisateur */}
          <div className="settings-section user-grade-selection">
            <h3>Mon Grade Actuel</h3>
            <div className="form-group">
              <label htmlFor="user-grade-select">Sélectionnez votre grade:</label>
              <select
                id="user-grade-select"
                value={userSelectedGrade}
                onChange={handleUserGradeSelection}
                disabled={allGrades.length === 0}
              >
                {allGrades.length === 0 ? (
                  <option value="">Aucun grade disponible</option>
                ) : (
                  allGrades.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))
                )}
              </select>
            </div>
            {allGrades.length === 0 && (
              <p className="info-message">Veuillez ajouter des grades ci-dessous pour pouvoir en sélectionner un.</p>
            )}
          </div>

          {/* Section pour ajouter un nouveau grade */}
          <div className="settings-section add-grade-section">
            <h3>Ajouter un Nouveau Grade</h3>
            <div className="form-group add-grade-input-group">
              <input
                type="text"
                placeholder="Nom du nouveau grade (ex: Caporal)"
                value={newGradeName}
                onChange={handleNewGradeNameChange}
              />
              <button type="button" onClick={handleAddGrade}>Ajouter le grade</button>
            </div>
          </div>

          {/* Section pour gérer les taux horaires par grade */}
          <form onSubmit={handleSubmitRates} className="settings-form">
            <h3>Gérer les Taux Horaires par Grade</h3>
            {allGrades.length === 0 ? (
              <p className="info-message">Aucun grade défini. Ajoutez un grade ci-dessus pour commencer à définir les taux.</p>
            ) : (
              allGrades.map(grade => (
                <div key={grade} className="grade-rates-section">
                  <h4>Taux pour le grade: <span>{grade}</span></h4>
                  {/* Champ pour le taux horaire de base */}
                  <div className="form-group">
                    <label htmlFor={`${grade}-base_rate`}>Taux horaire de base (€/heure):</label>
                    <input
                      type="number"
                      id={`${grade}-base_rate`}
                      name={`${grade}-base_rate`}
                      value={hourlyRates[grade]?.base_rate || 0}
                      onChange={(e) => handleRateChange(grade, 'base_rate', e.target.value)}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  {/* Champs pour les pourcentages des activités */}
                  {activityTypes.map((type) => (
                    <div className="form-group" key={`${grade}-${type}`}>
                      <label htmlFor={`${grade}-${type}`}>Pourcentage {type.charAt(0).toUpperCase() + type.slice(1)} (%):</label>
                      <input
                        type="number"
                        id={`${grade}-${type}`}
                        name={`${grade}-${type}`}
                        value={hourlyRates[grade]?.[type] || 0}
                        onChange={(e) => handleRateChange(grade, type, e.target.value)}
                        step="1" // Les pourcentages sont généralement des nombres entiers
                        min="0"
                        required
                      />
                    </div>
                  ))}
                </div>
              ))
            )}
            <button type="submit" disabled={allGrades.length === 0}>Sauvegarder tous les taux</button>
          </form>
        </>
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

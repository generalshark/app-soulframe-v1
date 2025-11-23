// soulframe-stats-module.js - VERSION PROPRE ET COMMENTÉE
window.SoulframeStats = (function() {
    'use strict';
    
    // =============================================================================
    // CONFIGURATION ET ÉTAT DU MODULE
    // =============================================================================
    
    const module = {
        statsData: null,           // Données statistiques principales
        lastUpdate: null,          // Timestamp de la dernière mise à jour
        refreshMode: 'auto',       // Mode de rafraîchissement (auto/manual)
        greenTagsConfig: {         // Configuration des tags verts
            display: true,
            cumulative: true,
            daily: true
        },
        currentPeriod: 'day',      // Période active pour les graphiques
        lastPayload: null,         // Dernier payload reçu du jeu
        seriesVisibility: {        // Visibilité des séries dans les graphiques
            dracs: true,
            kills: true,
            subBossKills: true,
            items: true
        }
    };

    // =============================================================================
    // FONCTIONS DE BASE ET UTILITAIRES
    // =============================================================================

    /**
     * Retourne des données statistiques par défaut
     * Utilisé lors de l'initialisation ou de la réinitialisation
     */
    function getDefaultStatsData() {
        return {
            totalSessions: 0,
            totalPlayTime: 0,
            averageSession: 0,
            hourly: Array(24).fill(0),
            lastUpdate: null,
            // Données pour les graphiques par période
            dailyData: {},
            weeklyData: {},
            monthlyData: {},
            yearlyData: {},
            // Temps de jeu réel avec historique
            realPlayTime: getDefaultRealPlayTime()
        };
    }

    /**
     * Structure par défaut pour le tracking du temps de jeu réel
     * Contient les cumuls par période et les métadonnées de tracking
     */
    function getDefaultRealPlayTime() {
        return {
            // Cumuls par période (en secondes)
            today: 0,
            week: 0,
            month: 0,

            // Historique brut des deltas TIME PLAYED
            timeDiffs: [],

            // Dernière valeur connue de Stats.TimePlayedSec
            lastTimePlayed: 0,

            // Marqueurs de reset (jour / semaine / mois)
            lastReset: {
                day: null,
                week: null,
                month: null
            },

            // Détection "en jeu / plus en jeu"
            // Dernière fois où TIME PLAYED a effectivement augmenté (delta > 0)
            lastPlaytimeChangeAt: null,

            // true = potentiellement en jeu (depuis < 20min)
            // false = jeu fermé / inactif (TIME PLAYED figé depuis ≥ 20min)
            isInGame: false
        };
    }

    /**
     * Retourne la visibilité par défaut des séries
     */
    function getDefaultSeriesVisibility() {
        return {
            dracs: true,
            kills: true,
            subBossKills: true,
            items: true
        };
    }

    /**
     * Retourne la date locale au format "YYYY-MM-DD"
     */
    function getLocalDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Calcule le numéro de semaine dans l'année
     */
    function getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    /**
     * Formate le temps en secondes en format lisible (heures et minutes)
     */
    function formatTime(seconds) {
        if (!seconds || seconds === 0) return "0m";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    /**
     * Formate les grands nombres en format compact (k, M)
     */
    function formatCompactNumber(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return String(value);
    }

    // =============================================================================
    // GESTION DU TEMPS DE JEU RÉEL
    // =============================================================================

    /**
     * Vérifie et réinitialise les périodes si nécessaire
     * S'exécute au chargement et avant chaque calcul de temps
     */
    function checkAndResetPeriods() {
        const now = new Date();
        const today = getLocalDateKey(now);
        const currentWeek = getWeekNumber(now);
        const currentMonth = now.getMonth();

        // Initialisation des reset si manquants
        if (!module.statsData.realPlayTime.lastReset.day) {
            module.statsData.realPlayTime.lastReset.day = today;
        }
        if (!module.statsData.realPlayTime.lastReset.week) {
            module.statsData.realPlayTime.lastReset.week = currentWeek;
        }
        if (!module.statsData.realPlayTime.lastReset.month) {
            module.statsData.realPlayTime.lastReset.month = currentMonth;
        }

        // Réinitialisation du jour si nouveau jour détecté
        if (module.statsData.realPlayTime.lastReset.day !== today) {
            console.log('🔄 Resetting today playtime - new day');
            module.statsData.realPlayTime.today = 0;
            module.statsData.realPlayTime.lastReset.day = today;
        }

        // Réinitialisation de la semaine si nouvelle semaine détectée
        if (module.statsData.realPlayTime.lastReset.week !== currentWeek) {
            console.log('🔄 Resetting week playtime - new week');
            module.statsData.realPlayTime.week = 0;
            module.statsData.realPlayTime.lastReset.week = currentWeek;
        }

        // Réinitialisation du mois si nouveau mois détecté
        if (module.statsData.realPlayTime.lastReset.month !== currentMonth) {
            console.log('🔄 Resetting month playtime - new month');
            module.statsData.realPlayTime.month = 0;
            module.statsData.realPlayTime.lastReset.month = currentMonth;
        }
    }

    /**
     * Calcule et enregistre la différence de temps de jeu entre deux payloads
     * Retourne la différence valide en secondes
     */
    function calculateAndRecordTimeDifference(newData) {
        if (!newData || !newData.Stats) return 0;

        const currentTimePlayed = Number(newData.Stats.TimePlayedSec) || 0;
        const lastTimePlayed = module.statsData.realPlayTime.lastTimePlayed || 0;
        
        console.log('⏱️ Time calculation:', {
            currentTime: currentTimePlayed,
            lastTime: lastTimePlayed,
            difference: currentTimePlayed - lastTimePlayed
        });
        
        // Premier enregistrement valide - on initialise seulement
        if (lastTimePlayed === 0 && currentTimePlayed > 0) {
            module.statsData.realPlayTime.lastTimePlayed = currentTimePlayed;
            console.log('📝 First valid TIME PLAYED recorded:', currentTimePlayed);
            return 0;
        }

        // Calcul de la différence
        const timeDiff = currentTimePlayed - lastTimePlayed;
        
        // Validations de sécurité
        if (timeDiff <= 0) {
            console.log('❌ Non-positive time difference - ignoring');
            return 0;
        }
        
        // Validation plus permissive pour le débogage
        if (timeDiff > 36000) {
            console.log('⚠️ Large time difference - allowing for debug:', timeDiff + 's');
        }
        
        if (timeDiff < 5) {
            console.log('❌ Time diff < 5s - ignoring');
            return 0;
        }

        console.log(`✅ Valid time difference: ${timeDiff}s (${(timeDiff/60).toFixed(1)}min)`);
        
        // Enregistrement avec timestamp
        const now = new Date();
        module.statsData.realPlayTime.timeDiffs.push({
            timestamp: now.toISOString(),
            timeDiff: timeDiff,
            totalTimePlayed: currentTimePlayed
        });

        // Limite à 1000 enregistrements maximum
        if (module.statsData.realPlayTime.timeDiffs.length > 1000) {
            module.statsData.realPlayTime.timeDiffs = module.statsData.realPlayTime.timeDiffs.slice(-1000);
        }

        // Mise à jour du dernier TIME PLAYED connu
        module.statsData.realPlayTime.lastTimePlayed = currentTimePlayed;

        return timeDiff;
    }

    /**
     * Met à jour le statut "en jeu / plus en jeu" avec la règle des 20 minutes
     */
    function updateInGameStatus(timeDiff) {
        if (!module.statsData || !module.statsData.realPlayTime) return;

        const rt = module.statsData.realPlayTime;
        const now = Date.now();

        // Si delta de temps détecté - utilisateur en jeu
        if (timeDiff > 0) {
            rt.lastPlaytimeChangeAt = new Date(now).toISOString();
            rt.isInGame = true;
            return;
        }

        // Pas de delta - vérification du temps écoulé depuis le dernier changement
        if (!rt.lastPlaytimeChangeAt) {
            rt.isInGame = false;
            return;
        }

        const last = new Date(rt.lastPlaytimeChangeAt).getTime();
        if (isNaN(last)) {
            rt.isInGame = false;
            return;
        }

        const diffMs = now - last;
        const THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

        // Règle : TIME PLAYED figé depuis ≥ 20min ⇒ jeu considéré comme fermé
        rt.isInGame = diffMs < THRESHOLD_MS;
    }

    /**
     * Met à jour les temps cumulés par période avec la différence de temps
     */
    function updatePeriodTimes(timeDiff) {
        if (timeDiff <= 0) return;

        // Vérification et réinitialisation des périodes si nécessaire
        checkAndResetPeriods();

        // Ajout du temps aux périodes
        module.statsData.realPlayTime.today += timeDiff;
        module.statsData.realPlayTime.week += timeDiff;
        module.statsData.realPlayTime.month += timeDiff;

        console.log('📊 Period times updated:', {
            today: module.statsData.realPlayTime.today,
            week: module.statsData.realPlayTime.week,
            month: module.statsData.realPlayTime.month,
            timeDiff: timeDiff
        });
    }

    // =============================================================================
    // CALCUL DES TEMPS DE JEU PAR PÉRIODE
    // =============================================================================

    /**
     * Calcule le temps de jeu aujourd'hui (avec vérification de reset)
     */
    function calculateTodayPlaytime() {
        if (!module.statsData.realPlayTime) return 0;
        checkAndResetPeriods();
        return module.statsData.realPlayTime.today || 0;
    }

    /**
     * Calcule le temps de jeu cette semaine (avec vérification de reset)
     */
    function calculateWeekPlaytime() {
        if (!module.statsData.realPlayTime) return 0;
        checkAndResetPeriods();
        return module.statsData.realPlayTime.week || 0;
    }

    /**
     * Calcule le temps de jeu ce mois (avec vérification de reset)
     */
    function calculateMonthPlaytime() {
        if (!module.statsData.realPlayTime) return 0;
        checkAndResetPeriods();
        return module.statsData.realPlayTime.month || 0;
    }

    // =============================================================================
    // GESTION DES DONNÉES ET STOCKAGE
    // =============================================================================

    /**
     * Initialise les structures de données pour chaque période
     */
    function initializePeriodData() {
        const now = new Date();
        
        // Données du jour (par heure)
        const daily = {};
        for (let hour = 0; hour < 24; hour++) {
            daily[hour] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        
        // Données de la semaine (par jour)
        const weekly = {};
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            weekly[dateStr] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        
        // Données du mois (par semaine)
        const monthly = {};
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        let currentWeek = 1;
        let currentDate = new Date(startOfMonth);
        
        while (currentDate.getMonth() === now.getMonth()) {
            monthly[`week${currentWeek}`] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
            currentDate.setDate(currentDate.getDate() + 7);
            currentWeek++;
        }
        
        // Données de l'année (par mois)
        const yearly = {};
        for (let month = 0; month < 12; month++) {
            yearly[month] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        
        return { daily, weekly, monthly, yearly };
    }

    /**
     * Charge les données depuis le localStorage
     * Initialise les structures manquantes si nécessaire
     */
    module.loadFromStorage = function() {
        try {
            const saved = localStorage.getItem('soulframe_stats');
            if (saved) {
                const data = JSON.parse(saved);

                module.statsData = data.statsData || getDefaultStatsData();
                module.lastUpdate = data.lastUpdate || null;
                module.refreshMode = data.refreshMode || 'auto';
                module.greenTagsConfig = data.greenTagsConfig || module.greenTagsConfig;
                module.currentPeriod = data.currentPeriod || 'day';
                module.seriesVisibility = data.seriesVisibility || getDefaultSeriesVisibility();
                module.lastPayload = data.lastPayload || null;

                // Initialisation des données de période si manquantes
                const periodData = initializePeriodData();
                if (!module.statsData.dailyData) module.statsData.dailyData = periodData.daily;
                if (!module.statsData.weeklyData) module.statsData.weeklyData = periodData.weekly;
                if (!module.statsData.monthlyData) module.statsData.monthlyData = periodData.monthly;
                if (!module.statsData.yearlyData) module.statsData.yearlyData = periodData.yearly;
                
                // Initialisation CRITIQUE des temps réels
                if (!module.statsData.realPlayTime) {
                    module.statsData.realPlayTime = getDefaultRealPlayTime();
                } else {
                    // Fusion avec les valeurs par défaut pour les champs manquants
                    module.statsData.realPlayTime = {
                        ...getDefaultRealPlayTime(),
                        ...module.statsData.realPlayTime
                    };
                }

                // Vérification et réinitialisation des périodes
                checkAndResetPeriods();
            } else {
                // Première initialisation
                module.statsData = getDefaultStatsData();
                const periodData = initializePeriodData();
                module.statsData.dailyData = periodData.daily;
                module.statsData.weeklyData = periodData.weekly;
                module.statsData.monthlyData = periodData.monthly;
                module.statsData.yearlyData = periodData.yearly;
                module.seriesVisibility = getDefaultSeriesVisibility();
                module.lastUpdate = null;
                
                // Initialisation des temps réels
                module.statsData.realPlayTime = getDefaultRealPlayTime();
                checkAndResetPeriods();
            }
        } catch (e) {
            console.error('Error loading stats from storage:', e);
            // Fallback en cas d'erreur
            module.statsData = getDefaultStatsData();
            const periodData = initializePeriodData();
            module.statsData.dailyData = periodData.daily;
            module.statsData.weeklyData = periodData.weekly;
            module.statsData.monthlyData = periodData.monthly;
            module.statsData.yearlyData = periodData.yearly;
            module.seriesVisibility = getDefaultSeriesVisibility();
            module.lastUpdate = null;
            
            module.statsData.realPlayTime = getDefaultRealPlayTime();
            checkAndResetPeriods();
        }
    };

    /**
     * Sauvegarde les données dans le localStorage
     */
    module.saveToStorage = function() {
        try {
            const data = {
                statsData: module.statsData,
                lastUpdate: module.lastUpdate,
                refreshMode: module.refreshMode,
                greenTagsConfig: module.greenTagsConfig,
                currentPeriod: module.currentPeriod,
                seriesVisibility: module.seriesVisibility,
                lastPayload: module.lastPayload
            };
            localStorage.setItem('soulframe_stats', JSON.stringify(data));
        } catch (e) {
            console.error('Error saving stats to storage:', e);
        }
    };

    // =============================================================================
    // CALCUL DES STATISTIQUES ET ACTIVITÉS
    // =============================================================================

    /**
     * Nettoie et normalise les données statistiques
     */
    function sanitizeStats(data) {
        if (!data || typeof data !== "object") return { Stats: {} };

        const stats = data.Stats || {};

        return {
            Stats: {
                PickupCount: Number(stats.PickupCount) || 0,
                Income: Number(stats.Income) || 0,
                XP: Number(stats.XP) || 0,
                TimePlayedSec: Number(stats.TimePlayedSec) || 0,
                Enemies: Array.isArray(stats.Enemies) ? stats.Enemies : [],
                Weapons: Array.isArray(stats.Weapons) ? stats.Weapons : []
            }
        };
    }

    /**
     * Calcule la différence totale de kills entre deux payloads
     */
    function calculateKillsDifference(newData, oldData) {
        const newEnemies = newData?.Stats?.Enemies || [];
        const oldEnemies = oldData?.Stats?.Enemies || [];
        
        const newTotalKills = newEnemies.reduce((sum, enemy) => sum + (enemy.kills || 0), 0);
        const oldTotalKills = oldEnemies.reduce((sum, enemy) => sum + (enemy.kills || 0), 0);
        
        return Math.max(0, newTotalKills - oldTotalKills);
    }

    /**
     * Calcule la différence de kills de sub-boss
     * Les sub-boss sont identifiés par leur type
     */
    function calculateSubBossKillsDifference(newData, oldData) {
        const subBossTypes = [
            "SpiderSubBossAvatar", "NimrodSubBossAvatar", "MendicantWazzardSubBossAvatar",
            "MockeryArmoredManSubBossAvatar", "MendicantKnightBellCleaverSubBossAvatar",
            "MeleeGreatSwordSubBossAvatar", "CorruptedSproutFolkSubBossAvatar",
            "RangedHunterSubBossAvatar", "MeleeMaceOfficerSubBossAvatar", "MendicantKingAvatar"
        ];

        const newEnemies = newData?.Stats?.Enemies || [];
        const oldEnemies = oldData?.Stats?.Enemies || [];
        
        const newSubBossKills = newEnemies
            .filter(enemy => enemy?.type && subBossTypes.includes(enemy.type.split('/')?.pop()))
            .reduce((sum, enemy) => sum + (enemy.kills || 0), 0);
            
        const oldSubBossKills = oldEnemies
            .filter(enemy => enemy?.type && subBossTypes.includes(enemy.type.split('/')?.pop()))
            .reduce((sum, enemy) => sum + (enemy.kills || 0), 0);
        
        return Math.max(0, newSubBossKills - oldSubBossKills);
    }

    /**
     * Calcule les différences d'activité entre deux payloads
     * Retourne un objet avec les deltas pour chaque type d'activité
     */
    function calculateActivityDifferences(newData, oldData) {
        const oldStats = oldData?.Stats || {};
        const newStats = newData.Stats || {};
        
        return {
            kills: calculateKillsDifference(newData, oldData),
            subBossKills: calculateSubBossKillsDifference(newData, oldData),
            items: Math.max(0, (newStats.PickupCount || 0) - (oldStats.PickupCount || 0)),
            dracs: Math.max(0, (newStats.Income || 0) - (oldStats.Income || 0)),
            xp: Math.max(0, (newStats.XP || 0) - (oldStats.XP || 0))
        };
    }

    /**
     * Calcule le ratio d'activité par rapport au temps de jeu
     * Utile pour mesurer l'efficacité du joueur
     */
    module.getActivityRatio = function(period = 'today') {
        let playTime = 0;
        let activityScore = 0;

        switch (period) {
            case 'today':
                playTime = calculateTodayPlaytime();
                // Calcul de l'activité basée sur dailyData
                Object.values(module.statsData.dailyData || {}).forEach(hourData => {
                    activityScore += (hourData.dracs || 0) + (hourData.kills || 0) + (hourData.subBossKills || 0) + (hourData.items || 0);
                });
                break;
            case 'week':
                playTime = calculateWeekPlaytime();
                Object.values(module.statsData.weeklyData || {}).forEach(dayData => {
                    activityScore += (dayData.dracs || 0) + (dayData.kills || 0) + (dayData.subBossKills || 0) + (dayData.items || 0);
                });
                break;
            case 'month':
                playTime = calculateMonthPlaytime();
                Object.values(module.statsData.monthlyData || {}).forEach(weekData => {
                    activityScore += (weekData.dracs || 0) + (weekData.kills || 0) + (weekData.subBossKills || 0) + (weekData.items || 0);
                });
                break;
        }

        if (playTime === 0) return 0;
        
        // Ratio : activité par minute de jeu
        const ratio = activityScore / (playTime / 60);
        return Math.round(ratio * 100) / 100;
    };

    // =============================================================================
    // TRACKING D'ACTIVITÉ PRINCIPAL
    // =============================================================================

    /**
     * Fonction principale de tracking d'activité
     * Gère le temps de jeu et les statistiques d'activité
     */
    module.trackActivity = function(newData, _unusedOldData) {
        if (!newData || !newData.Stats) {
            console.warn('Invalid newData provided to trackActivity');
            return;
        }

        if (!module.statsData) {
            module.loadFromStorage();
        }

        const oldData = module.lastPayload || null;

        console.log('🔍 trackActivity called', {
            hasOldFromModule: !!oldData,
            lastUpdateBefore: module.lastUpdate,
            accountIdFromPayload: newData.AccountId,
            timePlayed: newData.Stats?.TimePlayedSec
        });

        // Vérification que l'utilisateur est en jeu (présence de TimePlayedSec)
        const isUserInGame =
            newData.Stats.TimePlayedSec !== undefined &&
            newData.Stats.TimePlayedSec !== null;

        if (!isUserInGame) {
            console.log('🚫 User not in game (missing TimePlayedSec) - skipping time tracking');
            module.lastPayload = newData;
            module.saveToStorage();
            return;
        }

        // 1️⃣ CALCUL DE LA DIFFÉRENCE DE TEMPS RÉEL
        const timeDiff = calculateAndRecordTimeDifference(newData);

        // 2️⃣ MISE À JOUR DU STATUT "EN JEU"
        updateInGameStatus(timeDiff);

        // 3️⃣ PREMIER APPEL : initialisation seulement
        if (!oldData) {
            console.log('📌 First payload stored as baseline');
            module.lastPayload = newData;
            if (!module.lastUpdate) {
                module.lastUpdate = new Date().toISOString();
            }
            module.saveToStorage();

            if (window.updateStatsUI) window.updateStatsUI();
            return;
        }

        // 4️⃣ CALCUL DES DELTAS D'ACTIVITÉ
        const activityDiffs = calculateActivityDifferences(newData, oldData);
        const hasRealActivity = Object.values(activityDiffs).some((diff) => diff > 0);

        console.log('Activity tracking analysis:', {
            activityDiffs,
            hasRealActivity,
            timeDiff,
            isUserInGame,
            isInGameFlag: module.statsData.realPlayTime?.isInGame
        });

        // Mise à jour conditionnelle basée sur l'activité réelle
        if (hasRealActivity || timeDiff > 0) {
            // ACTIVITÉ RÉELLE DÉTECTÉE : mise à jour complète
            module.lastUpdate = new Date().toISOString();
            console.log('🕒 LastUpdate UPDATED due to activity or play time');
            
            // Mise à jour des données de période (dracs, kills, etc.)
            module.updatePeriodData(newData, oldData);

            // Mise à jour des temps de période réels
            if (timeDiff > 0) {
                updatePeriodTimes(timeDiff);

                // Mise à jour des statistiques globales
                module.statsData.totalSessions += 1;
                module.statsData.totalPlayTime += timeDiff;

                if (module.statsData.totalSessions > 0) {
                    module.statsData.averageSession =
                        module.statsData.totalPlayTime / module.statsData.totalSessions;
                }

                const currentHour = new Date().getHours();
                module.statsData.hourly[currentHour] =
                    (module.statsData.hourly[currentHour] || 0) + 1;

                console.log('✅ REAL ACTIVITY tracked with time – session window counted');
            }
        } else {
            console.log('❌ No real activity or play time - lastUpdate UNCHANGED');
        }

        // 5️⃣ TOUJOURS mettre à jour le dernier payload
        module.lastPayload = newData;
        module.saveToStorage();

        if (window.updateStatsUI) window.updateStatsUI();
    };

    /**
     * Met à jour les données de période avec l'activité réelle
     * Ne s'exécute que si une activité significative est détectée
     */
    module.updatePeriodData = function(newData, oldData) {
        if (!oldData || !newData) return;

        const cleanNew = sanitizeStats(newData);
        const cleanOld = sanitizeStats(oldData);

        const activityDiffs = calculateActivityDifferences(cleanNew, cleanOld);

        const hasMeaningfulActivity = Object.values(activityDiffs).some(diff => diff > 0);
        
        if (!hasMeaningfulActivity) {
            console.log('No meaningful activity for period data update');
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const today = now.toISOString().split('T')[0];
        const currentWeek = Math.ceil((now.getDate() + 6 - now.getDay()) / 7);
        const currentMonth = now.getMonth();

        const { dracs, kills, subBossKills, items } = activityDiffs;

        // Mise à jour des données du jour (heure actuelle)
        if (!module.statsData.dailyData[currentHour]) {
            module.statsData.dailyData[currentHour] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.dailyData[currentHour].dracs += dracs;
        module.statsData.dailyData[currentHour].kills += kills;
        module.statsData.dailyData[currentHour].subBossKills += subBossKills;
        module.statsData.dailyData[currentHour].items += items;

        // Mise à jour des données de la semaine (jour actuel)
        if (!module.statsData.weeklyData[today]) {
            module.statsData.weeklyData[today] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.weeklyData[today].dracs += dracs;
        module.statsData.weeklyData[today].kills += kills;
        module.statsData.weeklyData[today].subBossKills += subBossKills;
        module.statsData.weeklyData[today].items += items;

        // Mise à jour des données du mois (semaine actuelle)
        const weekKey = `week${currentWeek}`;
        if (!module.statsData.monthlyData[weekKey]) {
            module.statsData.monthlyData[weekKey] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.monthlyData[weekKey].dracs += dracs;
        module.statsData.monthlyData[weekKey].kills += kills;
        module.statsData.monthlyData[weekKey].subBossKills += subBossKills;
        module.statsData.monthlyData[weekKey].items += items;

        // Mise à jour des données de l'année (mois actuel)
        if (!module.statsData.yearlyData[currentMonth]) {
            module.statsData.yearlyData[currentMonth] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.yearlyData[currentMonth].dracs += dracs;
        module.statsData.yearlyData[currentMonth].kills += kills;
        module.statsData.yearlyData[currentMonth].subBossKills += subBossKills;
        module.statsData.yearlyData[currentMonth].items += items;

        console.log('Period data updated with real activity:', activityDiffs);
    };

    // =============================================================================
    // GESTION DES MISE À JOUR MANUELLES
    // =============================================================================

    /**
     * Gestionnaire de rafraîchissement manuel
     * Utilisé lorsque l'utilisateur force une mise à jour
     */
    module.handleManualRefresh = function(newData) {
        console.log('🔄 Manual refresh called');
        
        module.lastUpdate = new Date().toISOString();
        module.lastPayload = newData;
        module.saveToStorage();
        
        module.notifyReactUpdate();
        console.log('⏰ Manual refresh - lastUpdate set to:', module.lastUpdate);
        
        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };

    /**
     * Mise à jour manuelle alternative
     * Délègue à trackActivity pour une logique cohérente
     */
    module.handleManualUpdate = function(newData, oldData) {
        console.log('🔄 Manual update triggered');
        this.trackActivity(newData, oldData);
    };

    // =============================================================================
    // INTERFACE UTILISATEUR - RENDU DES STATISTIQUES
    // =============================================================================

    /**
     * Rend l'interface complète des statistiques
     * Inclut les cartes de résumé et les graphiques
     */
    module.renderStatisticsUI = function() {
        if (!module.statsData) {
            module.loadFromStorage();
        }

        if (!module.statsData) {
            return '<div class="text-sm text-amber-200/80">No statistics data available</div>';
        }

        if (!module.seriesVisibility) {
            module.seriesVisibility = {
                dracs: true,
                kills: true,
                subBossKills: true,
                items: true
            };
        }

        return `
            <div class="space-y-6">
                <!-- 4 cartes de résumé -->
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    ${renderSummaryCard('Today Playtime', formatTime(calculateTodayPlaytime()))}
                    ${renderSummaryCard('Week Playtime', formatTime(calculateWeekPlaytime()))}
                    ${renderSummaryCard('Month Playtime', formatTime(calculateMonthPlaytime()))}
                    ${renderSummaryCard('Last Updated', module.getTimerDisplay())}
                </div>

                <!-- Bloc Activity Visualization -->
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl p-6 shadow-[0_0_22px_rgba(0,0,0,0.85)] w-full">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-semibold text-amber-200 mb-4">Activity Visualization</h3>

                        <!-- Onglets de période -->
                        <div class="flex gap-2 mb-4 border-b border-amber-800/40 pb-2">
                            ${['day', 'week', 'month', 'year'].map(period => `
                                <button
                                    type="button"
                                    onclick="window.SoulframeStats.setPeriod('${period}'); window.updateStatsUI && window.updateStatsUI();"
                                    class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                        module.currentPeriod === period
                                            ? 'bg-amber-900/60 text-amber-200 border border-amber-600/50 shadow-inner'
                                            : 'bg-[#12100d] text-amber-400 hover:text-amber-200 hover:bg-amber-900/30 border border-transparent'
                                    }"
                                >
                                    ${period.charAt(0).toUpperCase() + period.slice(1)}
                                </button>
                            `).join('')}
                        </div>

                        <!-- Boutons ON/OFF des séries -->
                        <div class="flex flex-wrap gap-2 mb-4 text-xs">
                            ${renderSeriesToggle('dracs', 'Dracs')}
                            ${renderSeriesToggle('kills', 'Kills')}
                            ${renderSeriesToggle('subBossKills', 'Sub-Boss Kills')}
                            ${renderSeriesToggle('items', 'Items Collected')}
                        </div>

                        <!-- Graphique principal -->
                        <div class="bg-[#0f0e0a] rounded-lg p-4 border border-amber-800/30 w-full" style="min-height: 450px;">
                            ${renderChart()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        /**
         * Rend une carte de résumé avec style cohérent
         */
        function renderSummaryCard(title, value) {
            return `
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl px-4 py-3 shadow-[0_0_16px_rgba(0,0,0,0.8)]">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <div class="text-[11px] tracking-[0.16em] uppercase text-amber-300/80">${title}</div>
                        <div class="text-lg font-bold text-amber-50">${value}</div>
                    </div>
                </div>
            `;
        }

        /**
         * Rend le graphique principal selon la période active
         */
        function renderChart() {
            const periodData = getCurrentPeriodData();
            if (!periodData || periodData.labels.length === 0) {
                return '<div class="text-amber-200/80 text-center py-12">No data available for this period</div>';
            }

            const vis = module.seriesVisibility || {
                dracs: true,
                kills: true,
                subBossKills: true,
                items: true
            };

            const visibleValues = [];
            if (vis.dracs) visibleValues.push(...periodData.dracs);
            if (vis.kills) visibleValues.push(...periodData.kills);
            if (vis.subBossKills) visibleValues.push(...periodData.subBossKills);
            if (vis.items) visibleValues.push(...periodData.items);

            if (visibleValues.length === 0) {
                return '<div class="text-amber-200/80 text-center py-12">No series selected</div>';
            }

            const maxOverall = Math.max(...visibleValues);
            if (maxOverall <= 0) {
                return '<div class="text-amber-200/80 text-center py-12">All values are zero for this period</div>';
            }

            // Configuration du graphique
            const chartHeight = 350;
            const tickCount = 5;
            const yTicks = [];
            for (let i = 0; i <= tickCount; i++) {
                const value = Math.round((maxOverall * i) / tickCount);
                yTicks.push(value);
            }

            const yAxisLabels = yTicks
                .slice()
                .reverse()
                .map(v => `
                    <div class="flex-1 flex items-center justify-end pr-2 text-[11px] text-amber-300/80">
                        ${formatCompactNumber(v)}
                    </div>
                `)
                .join('');

            const width = 250;
            const height = 320;
            const paddingTop = 8;
            const paddingBottom = 12;
            const plotHeight = height - paddingTop - paddingBottom;

            // Configuration des séries
            const seriesConfig = [
                { key: 'dracs', color: '#FBBF24', lineColor: '#FBBF24' },
                { key: 'kills', color: '#34D399', lineColor: '#34D399' },
                { key: 'subBossKills', color: '#F87171', lineColor: '#F87171' },
                { key: 'items', color: '#60A5FA', lineColor: '#60A5FA' }
            ];

            const svgLines = seriesConfig
                .filter(s => vis[s.key])
                .map(s => {
                    const values = periodData[s.key] || [];
                    const labels = periodData.labels || [];
                    const totalSlots = labels.length || values.length;

                    if (!values.length || !totalSlots) return '';

                    // Détermination du dernier index avec données valides
                    let lastIndexWithData = values.length - 1;

                    if (module.currentPeriod === 'day') {
                        // Pour la vue "Day", on s'arrête au dernier point avec valeur > 0
                        lastIndexWithData = -1;
                        for (let i = 0; i < values.length; i++) {
                            const v = values[i];
                            if (typeof v === 'number' && !isNaN(v) && v > 0) {
                                lastIndexWithData = i;
                            }
                        }

                        if (lastIndexWithData === -1) {
                            return '';
                        }
                    }

                    // Génération des points du graphique
                    const points = [];
                    for (let index = 0; index <= lastIndexWithData; index++) {
                        const v = values[index];
                        const safeValue = typeof v === 'number' && !isNaN(v) ? v : 0;
                        const ratio = maxOverall > 0 ? safeValue / maxOverall : 0;

                        const x = totalSlots === 1
                            ? width / 2
                            : (index / (totalSlots - 1)) * (width - 8) + 4;

                        const y = height - paddingBottom - ratio * plotHeight;
                        const xLabel = labels[index] || '';

                        points.push({ x, y, value: safeValue, xLabel });
                    }

                    if (!points.some(p => p.value > 0)) {
                        return '';
                    }

                    // Génération du chemin SVG
                    const pathData = points
                        .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
                        .join(' ');

                    // Génération des points interactifs
                    const circles = points
                        .map(p => `
                            <g>
                                <title>${getSeriesLabel(s.key)}: ${p.value}\n${p.xLabel}</title>
                                
                                <!-- Point visible -->
                                <circle 
                                    cx="${p.x.toFixed(2)}" 
                                    cy="${p.y.toFixed(2)}" 
                                    r="0.6" 
                                    fill="${s.color}" 
                                    stroke="${s.lineColor}"
                                    stroke-width="0.15"
                                />

                                <!-- Zone de hit invisible pour le tooltip -->
                                <circle
                                    cx="${p.x.toFixed(2)}"
                                    cy="${p.y.toFixed(2)}"
                                    r="10"
                                    fill="transparent"
                                />
                            </g>
                        `)
                        .join('');

                    return `
                        <path d="${pathData}" fill="none" stroke="${s.lineColor}" stroke-width="0.3" stroke-linejoin="round" stroke-linecap="round" />
                        ${circles}
                    `;
                })
                .join('');

            const xAxisLabels = periodData.labels
                .map(label => `
                    <div class="flex-1 text-center text-[11px] text-amber-300/80">${label}</div>
                `)
                .join('');

            return `
                <div class="relative">
                    <div class="flex">
                        <div class="flex flex-col justify-between" style="width: 44px; height: ${chartHeight}px">
                            ${yAxisLabels}
                        </div>

                        <div class="relative flex-1" style="height: ${chartHeight}px">
                            <div class="absolute inset-0 flex flex-col justify-between">
                                ${Array.from({ length: tickCount + 1 }, () => `
                                    <div class="border-t border-amber-800/20"></div>
                                `).join('')}
                            </div>

                            <div class="absolute inset-y-4 left-0 right-0 flex items-end">
                                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="w-full h-full">
                                    ${svgLines}
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div class="mt-2 flex">
                        <div style="width: 44px;"></div>
                        <div class="flex-1 flex">
                            ${xAxisLabels}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Retourne le libellé d'une série
         */
        function getSeriesLabel(key) {
            const labels = {
                dracs: 'Dracs',
                kills: 'Kills',
                subBossKills: 'Sub-Boss Kills',
                items: 'Items Collected'
            };
            return labels[key] || key;
        }

        /**
         * Récupère les données pour la période active
         */
        function getCurrentPeriodData() {
            const now = new Date();
            let labels = [];
            let dracs = [];
            let kills = [];
            let subBossKills = [];
            let items = [];

            switch (module.currentPeriod) {
                case 'day':
                    for (let hour = 0; hour < 24; hour++) {
                        labels.push(`${hour}h`);
                        const data = module.statsData.dailyData[hour] || { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
                        dracs.push(data.dracs);
                        kills.push(data.kills);
                        subBossKills.push(data.subBossKills);
                        items.push(data.items);
                    }
                    break;

                case 'week':
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay());
                    for (let i = 0; i < 7; i++) {
                        const date = new Date(startOfWeek);
                        date.setDate(startOfWeek.getDate() + i);
                        const dateStr = date.toISOString().split('T')[0];
                        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        labels.push(dayNames[date.getDay()]);
                        const data = module.statsData.weeklyData[dateStr] || { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
                        dracs.push(data.dracs);
                        kills.push(data.kills);
                        subBossKills.push(data.subBossKills);
                        items.push(data.items);
                    }
                    break;

                case 'month':
                    const weeksInMonth = Object.keys(module.statsData.monthlyData).length;
                    for (let week = 1; week <= weeksInMonth; week++) {
                        labels.push(`W${week}`);
                        const data = module.statsData.monthlyData[`week${week}`] || { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
                        dracs.push(data.dracs);
                        kills.push(data.kills);
                        subBossKills.push(data.subBossKills);
                        items.push(data.items);
                    }
                    break;

                case 'year':
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    for (let month = 0; month < 12; month++) {
                        labels.push(monthNames[month]);
                        const data = module.statsData.yearlyData[month] || { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
                        dracs.push(data.dracs);
                        kills.push(data.kills);
                        subBossKills.push(data.subBossKills);
                        items.push(data.items);
                    }
                    break;
            }

            return { labels, dracs, kills, subBossKills, items };
        }
    };

    /**
     * Rend un bouton de toggle pour une série
     */
    function renderSeriesToggle(key, label) {
        const isOn = !!module.seriesVisibility[key];

        const baseClasses = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors';
        const onClasses = 'bg-amber-900/60 border-amber-500/80 text-amber-100 shadow-inner';
        const offClasses = 'bg-[#12100d] border-amber-800/70 text-amber-400 hover:text-amber-100 hover:border-amber-500/80';

        const colorClass =
            key === 'dracs'
                ? 'bg-amber-400'
                : key === 'kills'
                ? 'bg-emerald-400'
                : key === 'subBossKills'
                ? 'bg-red-400'
                : 'bg-blue-400';

        return `
            <button
                type="button"
                onclick="window.SoulframeStats.toggleSeriesVisibility('${key}')"
                class="${baseClasses} ${isOn ? onClasses : offClasses}"
            >
                <span class="w-2 h-2 rounded-full ${colorClass}"></span>
                <span>${label}</span>
                <span class="text-[10px] uppercase tracking-[0.18em] ml-1">${isOn ? 'ON' : 'OFF'}</span>
            </button>
        `;
    }

    // =============================================================================
    // INTERFACE UTILISATEUR - PARAMÈTRES
    // =============================================================================

    /**
     * Rend l'interface des paramètres
     */
    module.renderSettingsUI = function() {
        return `
            <div class="space-y-6">
                <!-- Carte gestion des données -->
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl p-6 shadow-[0_0_22px_rgba(0,0,0,0.85)]">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-semibold text-amber-200 mb-4">Data Management</h3>
                        
                        <div class="flex gap-3 flex-wrap">
                            <button 
                                onclick="window.SoulframeStats.clearStatistics()"
                                class="px-4 py-2 bg-red-900/40 border border-red-700/70 text-red-100 rounded-lg hover:bg-red-800/80 transition-colors"
                            >
                                Clear Statistics
                            </button>

                            <button 
                                onclick="window.SoulframeStats.importStatistics()"
                                class="px-4 py-2 bg-blue-900/40 border border-blue-700/70 text-blue-100 rounded-lg hover:bg-blue-800/80 transition-colors"
                            >
                                Import Statistics
                            </button>
                            
                            <button 
                                onclick="window.SoulframeStats.debugTimeTracking()"
                                class="px-4 py-2 bg-purple-900/40 border border-purple-700/70 text-purple-100 rounded-lg hover:bg-purple-800/80 transition-colors"
                            >
                                Debug Time Tracking
                            </button>

                            <button 
                                onclick="window.SoulframeStats.resetPeriodTimes()"
                                class="px-4 py-2 bg-orange-900/40 border border-orange-700/70 text-orange-100 rounded-lg hover:bg-orange-800/80 transition-colors"
                            >
                                Reset Period Times
                            </button>

                            <button 
                                onclick="window.SoulframeStats.exportStatistics()"
                                class="px-4 py-2 bg-emerald-900/40 border border-emerald-700/70 text-emerald-100 rounded-lg hover:bg-emerald-800/80 transition-colors"
                            >
                                Export Statistics
                            </button>

                            <button 
                                onclick="window.SoulframeStats.downloadexcel()"
                                class="px-4 py-2 bg-emerald-900/40 border border-emerald-700/70 text-emerald-100 rounded-lg hover:bg-emerald-800/80 transition-colors"
                            >
                                Download Excel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // =============================================================================
    // GESTION DES PÉRIODES ET VISIBILITÉ
    // =============================================================================

    /**
     * Définit la période active pour les graphiques
     */
    module.setPeriod = function(period) {
        module.currentPeriod = period;
        module.saveToStorage();
    };

    /**
     * Bascule la visibilité d'une série dans les graphiques
     */
    module.toggleSeriesVisibility = function(key) {
        if (!module.seriesVisibility) {
            module.seriesVisibility = {
                dracs: true,
                kills: true,
                subBossKills: true,
                items: true
            };
        }

        if (!(key in module.seriesVisibility)) {
            console.warn('Unknown series key:', key);
            return;
        }

        module.seriesVisibility[key] = !module.seriesVisibility[key];
        module.saveToStorage();

        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };

    // =============================================================================
    // FONCTIONS D'AFFICHAGE ET TEMPS
    // =============================================================================

    /**
     * Retourne l'affichage formaté du temps depuis la dernière mise à jour
     */
    module.getTimerDisplay = function() {
        if (!module.lastUpdate) return "Never updated";
        
        const now = new Date();
        const lastUpdate = new Date(module.lastUpdate);
        
        if (isNaN(lastUpdate.getTime())) return "Invalid date";
        
        const diffMs = now - lastUpdate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h ago`;
        if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return "Just now";
    };

    /**
     * Notifie React d'une mise à jour (si l'interface React est utilisée)
     */
    module.notifyReactUpdate = function() {
        if (window.triggerStatsUpdate) {
            window.triggerStatsUpdate();
        }
    };

    // =============================================================================
    // GESTION DES RÉINITIALISATIONS
    // =============================================================================

    /**
     * Réinitialise manuellement les temps de période
     */
    module.resetPeriodTimes = function() {
        if (confirm('Reset today, week, and month play times to zero?')) {
            module.statsData.realPlayTime.today = 0;
            module.statsData.realPlayTime.week = 0;
            module.statsData.realPlayTime.month = 0;
            
            const now = new Date();
            module.statsData.realPlayTime.lastReset = {
                day: getLocalDateKey(now),
                week: getWeekNumber(now),
                month: now.getMonth()
            };
            
            module.saveToStorage();
            
            if (window.updateStatsUI) {
                window.updateStatsUI();
            }
            
            alert('Period play times reset to zero!');
        }
    };

    /**
     * Efface COMPLÈTEMENT toutes les statistiques
     */
    module.clearStatistics = function() {
        if (confirm('Are you sure you want to clear ALL statistics data? This will reset everything to zero.')) {
            module.statsData = getDefaultStatsData();
            const periodData = initializePeriodData();
            module.statsData.dailyData = periodData.daily;
            module.statsData.weeklyData = periodData.weekly;
            module.statsData.monthlyData = periodData.monthly;
            module.statsData.yearlyData = periodData.yearly;
            
            module.statsData.totalSessions = 0;
            module.statsData.totalPlayTime = 0;
            module.statsData.averageSession = 0;
            module.statsData.hourly = Array(24).fill(0);
            
            module.lastUpdate = new Date().toISOString();
            module.lastPayload = null;
            module.saveToStorage();
            
            if (window.updateStatsUI) {
                window.updateStatsUI();
            }
            
            alert('Statistics COMPLETELY reset to zero!');
        }
    };

    // =============================================================================
    // IMPORT/EXPORT DE DONNÉES
    // =============================================================================

    /**
     * Exporte les statistiques au format JSON
     */
    module.exportStatistics = function() {
        if (!module.statsData || module.statsData.totalSessions === 0) {
            alert('No statistics data to export');
            return;
        }

        const dataStr = JSON.stringify({
            statsData: module.statsData,
            lastUpdate: module.lastUpdate,
            exportDate: new Date().toISOString()
        }, null, 2);
        
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'soulframe-statistics.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    /**
     * Importe les statistiques depuis un fichier JSON
     */
    module.importStatistics = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    if (!importedData.statsData) {
                        alert('Invalid statistics file format');
                        return;
                    }
                    
                    if (confirm('Replace current statistics with imported data?')) {
                        module.statsData = importedData.statsData;
                        module.lastUpdate = importedData.lastUpdate || new Date().toISOString();
                        module.saveToStorage();
                        
                        if (window.updateStatsUI) {
                            window.updateStatsUI();
                        }
                        
                        alert('Statistics imported successfully!');
                    }
                } catch (error) {
                    alert('Error importing statistics: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    };

    /**
     * Passerelle vers la fonction React d'export Excel
     */
    module.downloadexcel = function() {
        if (window.SoulframeDownloadExcel) {
            window.SoulframeDownloadExcel();
        } else {
            alert("Excel export is not available yet. Try refreshing the page after stats are loaded.");
        }
    };

    // =============================================================================
    // FONCTIONS DE DÉBOGAGE ET RÉPARATION
    // =============================================================================

    /**
     * Affiche les informations de débogage du tracking de temps
     */
    module.debugTimeTracking = function() {
        if (!module.statsData) {
            module.loadFromStorage();
        }

        const rt = module.statsData.realPlayTime || getDefaultRealPlayTime();

        console.log('🕒 TIME TRACKING DEBUG:', {
            today: rt.today,
            week: rt.week,
            month: rt.month,
            lastTimePlayed: rt.lastTimePlayed,
            lastPlaytimeChangeAt: rt.lastPlaytimeChangeAt,
            isInGame: rt.isInGame,
            lastReset: rt.lastReset,
            lastPayload: module.lastPayload ? {
                hasStats: !!module.lastPayload.Stats,
                timePlayed: module.lastPayload.Stats?.TimePlayedSec,
                hasAccountId: !!module.lastPayload.AccountId
            } : 'No last payload',
            currentTime: new Date().toISOString()
        });
        
        if (rt.timeDiffs && rt.timeDiffs.length > 0) {
            const recentDiffs = rt.timeDiffs.slice(-5);
            console.log('📊 Recent time diffs:', recentDiffs);
        } else {
            console.log('📊 No time diffs recorded yet');
        }
        
        return 'Debug completed!';
    };

    /**
     * Réparation des données de tracking de temps
     */
    module.fixTimeTrackingData = function() {
        console.log('🔧 Starting time tracking data repair...');
        
        if (!module.statsData) {
            module.loadFromStorage();
        }

        if (!module.statsData) {
            console.log('❌ No statsData available');
            return 'No stats data available';
        }

        // Recréation propre de la structure realPlayTime
        if (!module.statsData.realPlayTime) {
            module.statsData.realPlayTime = getDefaultRealPlayTime();
            console.log('🔧 Created missing realPlayTime structure from defaults');
        } else {
            module.statsData.realPlayTime = {
                ...getDefaultRealPlayTime(),
                ...module.statsData.realPlayTime
            };
            console.log('🔧 Merged existing realPlayTime with defaults');
        }
        
        module.saveToStorage();
        console.log('🔧 Time tracking data repaired successfully');
        
        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
        
        return 'Time tracking data repaired!';
    };

    /**
     * Correction d'urgence pour le tracking de temps
     */
    module.emergencyTimeFix = function() {
        console.log('🚨 APPLYING EMERGENCY TIME FIX');
        
        if (!this.statsData) {
            this.loadFromStorage();
        }
        
        // Vérification de la disponibilité des données
        if (!this.lastPayload || !this.lastPayload.Stats || !this.lastPayload.Stats.TimePlayedSec) {
            console.log('❌ No valid payload with TimePlayedSec available');
            return 'No valid game data available for fix';
        }
        
        const currentTime = Number(this.lastPayload.Stats.TimePlayedSec) || 0;
        const now = new Date();
        
        // Réinitialisation complète du système de temps
        this.statsData.realPlayTime = {
            ...getDefaultRealPlayTime(),
            lastTimePlayed: currentTime,
            lastPlaytimeChangeAt: now.toISOString(),
            isInGame: true,
            lastReset: {
                day: getLocalDateKey(now),
                week: getWeekNumber(now),
                month: now.getMonth()
            }
        };
        
        console.log('✅ Emergency fix applied - lastTimePlayed set to:', currentTime);
        this.saveToStorage();
        
        return 'Emergency time fix applied! Next tracking should work.';
    };

    /**
     * Vérifie que toutes les fonctions nécessaires sont disponibles
     */
    module.verifyFunctions = function() {
        const functions = [
            'fixTimeTrackingData',
            'debugTimeTracking', 
            'saveToStorage',
            'loadFromStorage',
            'trackActivity',
            'renderStatisticsUI'
        ];
        
        const missing = functions.filter(fn => typeof module[fn] !== 'function');
        
        if (missing.length > 0) {
            console.log('❌ Missing functions:', missing);
            return false;
        } else {
            console.log('✅ All functions are available');
            return true;
        }
    };

    /**
     * Affiche les informations de débogage générales
     */
    module.debugStats = function() {
        console.log('Stats Module Debug:', {
            statsData: module.statsData,
            lastUpdate: module.lastUpdate,
            refreshMode: module.refreshMode,
            greenTagsConfig: module.greenTagsConfig
        });
    };

    // =============================================================================
    // INITIALISATION ET CONFIGURATION AUTOMATIQUE
    // =============================================================================

    /**
     * Initialise le timer automatique pour les mises à jour
     */
    module.initializeTimer = function(callback, interval = 6 * 60 * 1000) {
        if (module.refreshMode === 'auto') {
            setInterval(callback, interval);
        }
    };

    /**
     * Initialise le rafraîchissement périodique de l'UI
     */
    module.initializeTimerRefresh = function() {
        setInterval(function() {
            if (window.updateStatsUI) {
                window.updateStatsUI();
            }
        }, 30000);
    };

    /**
     * Force une mise à jour manuelle
     */
    module.forceUpdate = function() {
        module.lastUpdate = new Date().toISOString();
        module.saveToStorage();
        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };

    /**
     * Synchronise avec l'état React
     */
    module.syncWithReactState = function(reactPayload) {
        if (reactPayload) {
            console.log('🔄 Syncing stats module with React payload');
            module.lastPayload = reactPayload;
            module.saveToStorage();
        }
    };

    /**
     * Définit le mode de rafraîchissement
     */
    module.setRefreshMode = function(mode) {
        module.refreshMode = mode;
        module.saveToStorage();
        
        if (mode === 'auto') {
            module.initializeTimerRefresh();
        }
        
        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };

    /**
     * Bascule la configuration des tags verts
     */
    module.toggleGreenTagConfig = function(key, value) {
        module.greenTagsConfig[key] = value;
        module.saveToStorage();
        if (window.triggerGreenTagsUpdate) {
            window.triggerGreenTagsUpdate();
        }

        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };

    // =============================================================================
    // INITIALISATION FINALE DU MODULE
    // =============================================================================

    // Chargement initial depuis le stockage
    module.loadFromStorage();
    
    // Initialisation du rafraîchissement automatique
    module.initializeTimerRefresh();

    return module;
})();
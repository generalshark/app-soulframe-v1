// soulframe-stats-module.js
window.SoulframeStats = (function() {
    'use strict';
    
const module = {
    statsData: null,
    lastUpdate: null,
    refreshMode: 'auto',
    greenTagsConfig: {
        display: true,
        cumulative: true,
        daily: true
    },
    currentPeriod: 'day',
    lastPayload: null,
    seriesVisibility: {
        dracs: true,
        kills: true,
        subBossKills: true,
        items: true
    }
};
    // Fonction pour obtenir des données statistiques par défaut
// Fonction pour obtenir des données statistiques par défaut
function getDefaultStatsData() {
    return {
        totalSessions: 0,
        totalPlayTime: 0,
        averageSession: 0,
        hourly: Array(24).fill(0),
        lastUpdate: null,
        // Nouvelles données pour les graphiques
        dailyData: {},
        weeklyData: {},
        monthlyData: {},
        yearlyData: {},
        // NOUVEAU : Temps de jeu réel par période avec historique
        realPlayTime: getDefaultRealPlayTime() // Utilisation de la fonction dédiée
    };
}
// Vérifier et réinitialiser les périodes si nécessaire
function checkAndResetPeriods() {
    const now = new Date();
    const today = getLocalDateKey(now);
    const currentWeek = getWeekNumber(now);
    const currentMonth = now.getMonth();

    if (!module.statsData.realPlayTime.lastReset.day) {
        module.statsData.realPlayTime.lastReset.day = today;
    }
    if (!module.statsData.realPlayTime.lastReset.week) {
        module.statsData.realPlayTime.lastReset.week = currentWeek;
    }
    if (!module.statsData.realPlayTime.lastReset.month) {
        module.statsData.realPlayTime.lastReset.month = currentMonth;
    }

    // Réinitialiser le temps du jour si nouveau jour
    if (module.statsData.realPlayTime.lastReset.day !== today) {
        module.statsData.realPlayTime.today = 0;
        module.statsData.realPlayTime.lastReset.day = today;
    }

    // Réinitialiser le temps de la semaine si nouvelle semaine
    if (module.statsData.realPlayTime.lastReset.week !== currentWeek) {
        module.statsData.realPlayTime.week = 0;
        module.statsData.realPlayTime.lastReset.week = currentWeek;
    }

    // Réinitialiser le temps du mois si nouveau mois
    if (module.statsData.realPlayTime.lastReset.month !== currentMonth) {
        module.statsData.realPlayTime.month = 0;
        module.statsData.realPlayTime.lastReset.month = currentMonth;
    }
}

// Obtenir le numéro de semaine dans l'année
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
// Retourne la date locale au format "YYYY-MM-DD"
function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 0 → janvier
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

    // Initialiser les données de période
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

    // Charger depuis le localStorage
    function getDefaultSeriesVisibility() {
        return {
            dracs: true,
            kills: true,
            subBossKills: true,
            items: true
        };
    }

    module.notifyReactUpdate = function() {
  if (window.triggerStatsUpdate) {
    window.triggerStatsUpdate();
  }
};

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


// Calculer le ratio d'activité par rapport au temps de jeu
module.getActivityRatio = function(period = 'today') {
    let playTime = 0;
    let activityScore = 0;

    switch (period) {
        case 'today':
            playTime = calculateTodayPlaytime();
            // Calculer l'activité d'aujourd'hui basée sur dailyData
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

// Fonction pour obtenir la structure par défaut des temps réels
// Fonction pour obtenir la structure par défaut des temps réels
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

        // 💡 Nouveau : détection "en jeu / plus en jeu"
        // Dernière fois où TIME PLAYED a effectivement augmenté (delta > 0)
        lastPlaytimeChangeAt: null, // ISO string

        // true  = potentiellement en jeu (depuis < 20min),
        // false = jeu fermé / inactif (TIME PLAYED figé depuis ≥ 20min)
        isInGame: false
    };
}

    // Charger depuis le localStorage
module.loadFromStorage = function() {
    try {
        const saved = localStorage.getItem('soulframe_stats');
        if (saved) {
            const data = JSON.parse(saved);

            module.statsData = data.statsData || getDefaultStatsData();
            // IMPORTANT : Toujours conserver l'ancien lastUpdate s'il existe
            module.lastUpdate = data.lastUpdate || null;
            module.refreshMode = data.refreshMode || 'auto';
            module.greenTagsConfig = data.greenTagsConfig || module.greenTagsConfig;
            module.currentPeriod = data.currentPeriod || 'day';
            module.seriesVisibility = data.seriesVisibility || getDefaultSeriesVisibility();
            module.lastPayload = data.lastPayload || null;

            // Initialiser les données de période
            const periodData = initializePeriodData();
            if (!module.statsData.dailyData) module.statsData.dailyData = periodData.daily;
            if (!module.statsData.weeklyData) module.statsData.weeklyData = periodData.weekly;
            if (!module.statsData.monthlyData) module.statsData.monthlyData = periodData.monthly;
            if (!module.statsData.yearlyData) module.statsData.yearlyData = periodData.yearly;
            
            // CORRECTION CRITIQUE : Initialiser les temps réels si inexistants ou incomplets
            if (!module.statsData.realPlayTime) {
                module.statsData.realPlayTime = getDefaultRealPlayTime();
            } else {
                // S'assurer que tous les champs nécessaires existent
                module.statsData.realPlayTime = {
                    ...getDefaultRealPlayTime(),
                    ...module.statsData.realPlayTime
                };
            }

            // Vérifier et réinitialiser les périodes au chargement
            checkAndResetPeriods();
        } else {
            module.statsData = getDefaultStatsData();
            const periodData = initializePeriodData();
            module.statsData.dailyData = periodData.daily;
            module.statsData.weeklyData = periodData.weekly;
            module.statsData.monthlyData = periodData.monthly;
            module.statsData.yearlyData = periodData.yearly;
            module.seriesVisibility = getDefaultSeriesVisibility();
            module.lastUpdate = null;
            
            // Initialiser les temps réels
            module.statsData.realPlayTime = getDefaultRealPlayTime();
            checkAndResetPeriods();
        }
    } catch (e) {
        console.error('Error loading stats from storage:', e);
        module.statsData = getDefaultStatsData();
        const periodData = initializePeriodData();
        module.statsData.dailyData = periodData.daily;
        module.statsData.weeklyData = periodData.weekly;
        module.statsData.monthlyData = periodData.monthly;
        module.statsData.yearlyData = periodData.yearly;
        module.seriesVisibility = getDefaultSeriesVisibility();
        module.lastUpdate = null;
        
        // Initialiser les temps réels
        module.statsData.realPlayTime = getDefaultRealPlayTime();
        checkAndResetPeriods();
    }
};
// Réinitialiser manuellement les temps de période
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

    // NOUVELLE FONCTION : Mise à jour manuelle séparée
    module.handleManualRefresh = function(newData) {
        console.log('🔄 Manual refresh called');
        
        // Pour les mises à jour manuelles, on met à jour lastUpdate
        module.lastUpdate = new Date().toISOString();
        module.lastPayload = newData;
        module.saveToStorage();
        
        module.notifyReactUpdate();
        console.log('⏰ Manual refresh - lastUpdate set to:', module.lastUpdate);
        
        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };


    // Sauvegarder dans le localStorage
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

    module.debugStats = function() {
        console.log('Stats Module Debug:', {
            statsData: module.statsData,
            lastUpdate: module.lastUpdate,
            refreshMode: module.refreshMode,
            greenTagsConfig: module.greenTagsConfig
        });
    };

    // Mettre à jour les données de période uniquement avec l'activité réelle
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

        // Mettre à jour les données du jour (heure actuelle)
        if (!module.statsData.dailyData[currentHour]) {
            module.statsData.dailyData[currentHour] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.dailyData[currentHour].dracs += dracs;
        module.statsData.dailyData[currentHour].kills += kills;
        module.statsData.dailyData[currentHour].subBossKills += subBossKills;
        module.statsData.dailyData[currentHour].items += items;

        // Mettre à jour les données de la semaine (jour actuel)
        if (!module.statsData.weeklyData[today]) {
            module.statsData.weeklyData[today] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.weeklyData[today].dracs += dracs;
        module.statsData.weeklyData[today].kills += kills;
        module.statsData.weeklyData[today].subBossKills += subBossKills;
        module.statsData.weeklyData[today].items += items;

        // Mettre à jour les données du mois (semaine actuelle)
        const weekKey = `week${currentWeek}`;
        if (!module.statsData.monthlyData[weekKey]) {
            module.statsData.monthlyData[weekKey] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.monthlyData[weekKey].dracs += dracs;
        module.statsData.monthlyData[weekKey].kills += kills;
        module.statsData.monthlyData[weekKey].subBossKills += subBossKills;
        module.statsData.monthlyData[weekKey].items += items;

        // Mettre à jour les données de l'année (mois actuel)
        if (!module.statsData.yearlyData[currentMonth]) {
            module.statsData.yearlyData[currentMonth] = { dracs: 0, kills: 0, subBossKills: 0, items: 0 };
        }
        module.statsData.yearlyData[currentMonth].dracs += dracs;
        module.statsData.yearlyData[currentMonth].kills += kills;
        module.statsData.yearlyData[currentMonth].subBossKills += subBossKills;
        module.statsData.yearlyData[currentMonth].items += items;

        console.log('Period data updated with real activity:', activityDiffs);
    };

    // Calculer la différence de kills
    function calculateKillsDifference(newData, oldData) {
        const newEnemies = newData?.Stats?.Enemies || [];
        const oldEnemies = oldData?.Stats?.Enemies || [];
        
        const newTotalKills = newEnemies.reduce((sum, enemy) => sum + (enemy.kills || 0), 0);
        const oldTotalKills = oldEnemies.reduce((sum, enemy) => sum + (enemy.kills || 0), 0);
        
        return Math.max(0, newTotalKills - oldTotalKills);
    }

    // Calculer la différence de kills de sub-boss
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

    // Obtenir l'affichage du timer
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

    // Initialiser le timer automatique
    module.initializeTimer = function(callback, interval = 6 * 60 * 1000) {
        if (module.refreshMode === 'auto') {
            setInterval(callback, interval);
        }
    };

    // Initialiser le rafraîchissement périodique du timer
    module.initializeTimerRefresh = function() {
        setInterval(function() {
            if (window.updateStatsUI) {
                window.updateStatsUI();
            }
        }, 30000);
    };

    // Forcer une mise à jour manuelle
    module.forceUpdate = function() {
        module.lastUpdate = new Date().toISOString();
        module.saveToStorage();
        if (window.updateStatsUI) {
            window.updateStatsUI();
        }
    };

// Tracking d'activité (temps de jeu + deltas de stats)
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
        // On log ce qu'on a, mais on n'en fait plus une condition de blocage
        accountIdFromPayload: newData.AccountId,
        timePlayed: newData.Stats?.TimePlayedSec
    });

    // ✅ Nouvelle règle : si TimePlayedSec existe, on peut tracker
    const isUserInGame =
        newData.Stats.TimePlayedSec !== undefined &&
        newData.Stats.TimePlayedSec !== null;

    if (!isUserInGame) {
        console.log('🚫 User not in game (missing TimePlayedSec) - skipping time tracking');
        // On met quand même à jour le dernier payload mais pas le temps
        module.lastPayload = newData;
        module.saveToStorage();
        return;
    }

    // CALCULER LA DIFFÉRENCE DE TEMPS RÉEL
    const timeDiff = calculateAndRecordTimeDifference(newData);


    // 2️⃣ Appliquer la règle des 20 minutes sur ce tick
    updateInGameStatus(timeDiff);

    // 3️⃣ Premier appel : juste initialiser le payload et le timestamp
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

    // 4️⃣ Deltas d'activité (dracs, kills, sub-boss, items...)
    const activityDiffs = calculateActivityDifferences(newData, oldData);
    const hasRealActivity = Object.values(activityDiffs).some((diff) => diff > 0);

    console.log('Activity tracking analysis:', {
        activityDiffs,
        hasRealActivity,
        timeDiff,
        isUserInGame,
        isInGameFlag: module.statsData.realPlayTime?.isInGame
    });

    if (hasRealActivity || timeDiff > 0) {
        // ACTIVITÉ RÉELLE ou TEMPS DE JEU : mettre à jour lastUpdate
        module.lastUpdate = new Date().toISOString();
        console.log('🕒 LastUpdate UPDATED due to activity or play time');
        
        // Mettre à jour les données de période (dracs, kills, etc.)
        module.updatePeriodData(newData, oldData);

        // METTRE À JOUR LES TEMPS DE PÉRIODE RÉELS
        if (timeDiff > 0) {
            updatePeriodTimes(timeDiff);

            // Mettre à jour les statistiques globales
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

    // 5️⃣ Toujours mettre à jour le dernier payload
    module.lastPayload = newData;
    module.saveToStorage();

    if (window.updateStatsUI) window.updateStatsUI();
};

    // CALCUL SÉCURISÉ du temps de jeu
    function calculateMeaningfulTimeDifference(newData, oldData) {
        if (!oldData || !oldData.Stats || !newData || !newData.Stats) {
            console.log('⛔ No valid previous data - time difference ignored.');
            return 0;
        }

        const oldTime = Number(oldData.Stats.TimePlayedSec) || 0;
        const newTime = Number(newData.Stats.TimePlayedSec) || 0;

        const rawDiff = newTime - oldTime;

        if (rawDiff <= 0) {
            console.log('❌ Non-positive time difference – ignored');
            return 0;
        }

        if (rawDiff > 7200) {
            console.log('❌ Time difference too large – capped to 10min');
            return 600;
        }

        if (rawDiff < 10) {
            console.log('❌ Time diff < 10s – ignored');
            return 0;
        }

        console.log(`⏱️ Time diff VALID: ${rawDiff}s (${(rawDiff/60).toFixed(1)}min)`);
        return rawDiff;
    }

    // Nettoyage des données
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

    // Version sécurisée de calculateActivityDifferences
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

    // Formater le temps en heures et minutes
    function formatTime(seconds) {
        if (!seconds || seconds === 0) return "0m";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }


// Fonctions de calcul du temps de jeu RÉEL
function calculateTodayPlaytime() {
    if (!module.statsData.realPlayTime) return 0;
    
    // Vérifier et réinitialiser les périodes si nécessaire
    checkAndResetPeriods();
    
    return module.statsData.realPlayTime.today || 0;
}

function calculateWeekPlaytime() {
    if (!module.statsData.realPlayTime) return 0;
    
    // Vérifier et réinitialiser les périodes si nécessaire
    checkAndResetPeriods();
    
    return module.statsData.realPlayTime.week || 0;
}

function calculateMonthPlaytime() {
    if (!module.statsData.realPlayTime) return 0;
    
    // Vérifier et réinitialiser les périodes si nécessaire
    checkAndResetPeriods();
    
    return module.statsData.realPlayTime.month || 0;
}
// Fonction pour rendre les boutons de toggle des séries
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

// Obtenir le numéro de semaine dans l'année
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Vérifier et réinitialiser les périodes si nécessaire
function checkAndResetPeriods() {
    const now = new Date();
    const today = getLocalDateKey(now);
    const currentWeek = getWeekNumber(now);
    const currentMonth = now.getMonth();

    if (!module.statsData.realPlayTime.lastReset.day) {
        module.statsData.realPlayTime.lastReset.day = today;
    }
    if (!module.statsData.realPlayTime.lastReset.week) {
        module.statsData.realPlayTime.lastReset.week = currentWeek;
    }
    if (!module.statsData.realPlayTime.lastReset.month) {
        module.statsData.realPlayTime.lastReset.month = currentMonth;
    }

    // Réinitialiser le temps du jour si nouveau jour
    if (module.statsData.realPlayTime.lastReset.day !== today) {
        console.log('🔄 Resetting today playtime - new day');
        module.statsData.realPlayTime.today = 0;
        module.statsData.realPlayTime.lastReset.day = today;
    }

    // Réinitialiser le temps de la semaine si nouvelle semaine
    if (module.statsData.realPlayTime.lastReset.week !== currentWeek) {
        console.log('🔄 Resetting week playtime - new week');
        module.statsData.realPlayTime.week = 0;
        module.statsData.realPlayTime.lastReset.week = currentWeek;
    }

    // Réinitialiser le temps du mois si nouveau mois
    if (module.statsData.realPlayTime.lastReset.month !== currentMonth) {
        console.log('🔄 Resetting month playtime - new month');
        module.statsData.realPlayTime.month = 0;
        module.statsData.realPlayTime.lastReset.month = currentMonth;
    }
}

// Met à jour le statut "en jeu / plus en jeu" en appliquant la règle des 20 minutes
function updateInGameStatus(timeDiff) {
    if (!module.statsData || !module.statsData.realPlayTime) return;

    const rt = module.statsData.realPlayTime;
    const now = Date.now();

    // Si on vient de détecter un vrai delta de temps de jeu
    if (timeDiff > 0) {
        rt.lastPlaytimeChangeAt = new Date(now).toISOString();
        rt.isInGame = true;
        return;
    }

    // Pas de delta sur ce tick : vérifier depuis quand le temps n'a pas bougé
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


// Calculer et enregistrer la différence de temps de jeu
// Remplacez la fonction calculateAndRecordTimeDifference par cette version :
function calculateAndRecordTimeDifference(newData) {
    if (!newData || !newData.Stats) return 0;

    const currentTimePlayed = Number(newData.Stats.TimePlayedSec) || 0;
    const lastTimePlayed = module.statsData.realPlayTime.lastTimePlayed || 0;
    
    console.log('⏱️ Time calculation:', {
        currentTime: currentTimePlayed,
        lastTime: lastTimePlayed,
        difference: currentTimePlayed - lastTimePlayed
    });
    
    // Si c'est le premier enregistrement valide, on initialise seulement
    if (lastTimePlayed === 0 && currentTimePlayed > 0) {
        module.statsData.realPlayTime.lastTimePlayed = currentTimePlayed;
        console.log('📝 First valid TIME PLAYED recorded:', currentTimePlayed);
        return 0;
    }

    // Calculer la différence
    const timeDiff = currentTimePlayed - lastTimePlayed;
    
    // Vérifications de sécurité
    if (timeDiff <= 0) {
        console.log('❌ Non-positive time difference - ignoring');
        return 0;
    }
    
    // Validation plus permissive pour le débogage
    if (timeDiff > 36000) { // 10 heures max pour le débogage
        console.log('⚠️ Large time difference - allowing for debug:', timeDiff + 's');
        // On permet les grandes différences temporairement pour le débogage
    }
    
    if (timeDiff < 5) { // Réduit à 5 secondes minimum
        console.log('❌ Time diff < 5s - ignoring');
        return 0;
    }

    console.log(`✅ Valid time difference: ${timeDiff}s (${(timeDiff/60).toFixed(1)}min)`);
    
    // Enregistrer la différence avec timestamp
    const now = new Date();
    module.statsData.realPlayTime.timeDiffs.push({
        timestamp: now.toISOString(),
        timeDiff: timeDiff,
        totalTimePlayed: currentTimePlayed
    });

    // Garder seulement les 1000 derniers enregistrements
    if (module.statsData.realPlayTime.timeDiffs.length > 1000) {
        module.statsData.realPlayTime.timeDiffs = module.statsData.realPlayTime.timeDiffs.slice(-1000);
    }

    // Mettre à jour le dernier TIME PLAYED
    module.statsData.realPlayTime.lastTimePlayed = currentTimePlayed;

    return timeDiff;
}
// Mettre à jour les temps de période avec la différence
function updatePeriodTimes(timeDiff) {
    if (timeDiff <= 0) return;

    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];
    const currentWeek = getWeekNumber(now);
    const currentMonth = now.getMonth();

    // Vérifier et réinitialiser les périodes si nécessaire
    checkAndResetPeriods();

    // Ajouter le temps aux périodes
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
    // Rendre l'interface des statistiques
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
            <!-- 4 petites cartes de résumé -->
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl px-4 py-3 shadow-[0_0_16px_rgba(0,0,0,0.8)]">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <div class="text-[11px] tracking-[0.16em] uppercase text-amber-300/80">Today Playtime</div>
                        <div class="text-lg font-bold text-amber-50">${formatTime(calculateTodayPlaytime())}</div>
                    </div>
                </div>
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl px-4 py-3 shadow-[0_0_16px_rgba(0,0,0,0.8)]">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <div class="text-[11px] tracking-[0.16em] uppercase text-amber-300/80">Week Playtime</div>
                        <div class="text-lg font-bold text-amber-50">${formatTime(calculateWeekPlaytime())}</div>
                    </div>
                </div>
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl px-4 py-3 shadow-[0_0_16px_rgba(0,0,0,0.8)]">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <div class="text-[11px] tracking-[0.16em] uppercase text-amber-300/80">Month Playtime</div>
                        <div class="text-lg font-bold text-amber-50">${formatTime(calculateMonthPlaytime())}</div>
                    </div>
                </div>
                <div class="relative bg-[#0b0a08]/90 border border-amber-700/70 rounded-xl px-4 py-3 shadow-[0_0_16px_rgba(0,0,0,0.8)]">
                    <div class="absolute inset-1 rounded-lg border border-amber-400/70 pointer-events-none"></div>
                    <div class="relative z-10">
                        <div class="text-[11px] tracking-[0.16em] uppercase text-amber-300/80">Last Updated</div>
                        <div class="text-lg font-bold text-amber-50">${module.getTimerDisplay()}</div>
                    </div>
                </div>
            </div>

            <!-- Bloc Activity Visualization - VERSION CORRIGÉE ET AGRANDIE -->
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

                    <!-- Graphique TRÈS AGRANDI -->
                    <div class="bg-[#0f0e0a] rounded-lg p-4 border border-amber-800/30 w-full" style="min-height: 450px;">
                        ${renderChart()}
                    </div>
                </div>
            </div>
        </div>
    `;

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

        // AUGMENTER la hauteur du graphique
        const chartHeight = 350; // Augmenté
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

        const width = 250; // AUGMENTÉ pour plus de largeur
        const height = 320;
        const paddingTop = 8;
        const paddingBottom = 12;
        const plotHeight = height - paddingTop - paddingBottom;

        const labelByKey = {
            dracs: 'Dracs',
            kills: 'Kills',
            subBossKills: 'Sub-Boss Kills',
            items: 'Items Collected'
        };

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

                // 👇 on décide jusqu'où on trace
                let lastIndexWithData = values.length - 1;

                if (module.currentPeriod === 'day') {
                    // Pour la vue "Day", on s'arrête au dernier point avec une vraie valeur > 0
                    lastIndexWithData = -1;
                    for (let i = 0; i < values.length; i++) {
                        const v = values[i];
                        if (typeof v === 'number' && !isNaN(v) && v > 0) {
                            lastIndexWithData = i;
                        }
                    }

                    // Si aucune valeur > 0 → pas de ligne pour cette série
                    if (lastIndexWithData === -1) {
                        return '';
                    }
                }

                const points = [];
                for (let index = 0; index <= lastIndexWithData; index++) {
                    const v = values[index];
                    const safeValue = typeof v === 'number' && !isNaN(v) ? v : 0;
                    const ratio = maxOverall > 0 ? safeValue / maxOverall : 0;

                    // ❗ X basé sur l'heure réelle (0..23), pas sur la longueur tronquée
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

                const pathData = points
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
                    .join(' ');

                const circles = points
    .map(p => `
        <g>
            <title>${labelByKey[s.key]}: ${p.value}\n${p.xLabel}</title>
            
            <!-- Petit point visible -->
            <circle 
                cx="${p.x.toFixed(2)}" 
                cy="${p.y.toFixed(2)}" 
                r="0.6" 
                fill="${s.color}" 
                stroke="${s.lineColor}"
                stroke-width="0.15"
            />

            <!-- Grande zone de hit invisible pour le tooltip -->
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

    function formatCompactNumber(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return String(value);
    }
};

    // Définir la période active
    module.setPeriod = function(period) {
        module.currentPeriod = period;
        module.saveToStorage();
    };

    // Basculer la visibilité d'une série
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

    // Rendre l'interface des paramètres - VERSION SIMPLIFIÉE
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
        </div>
    `;
};

    // Définir le mode de rafraîchissement
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

    // Basculer la configuration des tags verts
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

    // Exporter les statistiques
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

    // Importer les statistiques
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

    
    // Passerelle vers la fonction React d'export Excel
    module.downloadexcel = function() {
    if (window.SoulframeDownloadExcel) {
        window.SoulframeDownloadExcel();
    } else {
        alert("Excel export is not available yet. Try refreshing the page after stats are loaded.");
    }
   };

    // Effacer les statistiques COMPLÈTEMENT
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

    // FONCTION DE SAUVETAGE
    module.emergencySessionFix = function() {
        if (confirm('🚨 URGENCE: Vos statistiques de sessions sont corrompues! Réinitialiser les sessions et temps de jeu? (Gardera vos autres données)')) {
            const oldTotalPlayTime = module.statsData.totalPlayTime;
            const oldTotalSessions = module.statsData.totalSessions;
            
            module.statsData.totalSessions = 0;
            module.statsData.totalPlayTime = 0;
            module.statsData.averageSession = 0;
            module.statsData.hourly = Array(24).fill(0);
            
            module.saveToStorage();
            
            console.log('🚨 SESSION EMERGENCY FIX APPLIED:', {
                oldTotalPlayTime,
                oldTotalSessions,
                newTotalPlayTime: module.statsData.totalPlayTime,
                newTotalSessions: module.statsData.totalSessions
            });
            
            alert(`🚨 SESSIONS RÉINITIALISÉES!\nAncien: ${oldTotalSessions} sessions, ${Math.round(oldTotalPlayTime/3600)}h\nNouveau: 0 sessions, 0h`);
            
            if (window.updateStatsUI) {
                window.updateStatsUI();
            }
        }
    };
module.handleManualUpdate = function(newData, oldData) {
    console.log('🔄 Manual update triggered');

    // On délègue toute la logique (deltas, temps de jeu, inGame, etc.)
    // à trackActivity pour que manuel et auto se comportent pareil.
    this.trackActivity(newData, oldData);
};


// Fonction de réparation des données de temps
module.fixTimeTrackingData = function() {
    console.log('🔧 Starting time tracking data repair...');
    
    if (!module.statsData) {
        module.loadFromStorage();
    }

    if (!module.statsData) {
        console.log('❌ No statsData available');
        return 'No stats data available';
    }

    // Recréer proprement la structure realPlayTime à partir du modèle par défaut
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


// Fonction de debug
module.debugTimeTracking = function() {
    if (!module.statsData) {
        module.loadFromStorage();
    }

    console.log('🕒 TIME TRACKING DEBUG:', {
        realPlayTime: module.statsData.realPlayTime,
        lastPayload: module.lastPayload ? {
            hasStats: !!module.lastPayload.Stats,
            timePlayed: module.lastPayload.Stats?.TimePlayedSec,
            hasAccountId: !!module.lastPayload.AccountId
        } : 'No last payload',
        currentTime: new Date().toISOString()
    });
    
    // Afficher les différences de temps récentes
    if (module.statsData.realPlayTime.timeDiffs && module.statsData.realPlayTime.timeDiffs.length > 0) {
        const recentDiffs = module.statsData.realPlayTime.timeDiffs.slice(-5);
        console.log('📊 Recent time diffs:', recentDiffs);
    } else {
        console.log('📊 No time diffs recorded yet');
    }
    
    return 'Debug completed!';
};

// Vérifier que toutes les fonctions existent
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



    // Synchroniser avec l'état React
    module.syncWithReactState = function(reactPayload) {
        if (reactPayload) {
            console.log('🔄 Syncing stats module with React payload');
            module.lastPayload = reactPayload;
            module.saveToStorage();
        }
    };

    // Initialiser au chargement
    module.loadFromStorage();
    
    // Initialiser le rafraîchissement automatique du timer
    module.initializeTimerRefresh();
       // Correction d'urgence pour le tracking de temps
module.emergencyTimeFix = function() {
    console.log('🚨 APPLYING EMERGENCY TIME FIX');
    
    // S'assurer que les données sont chargées
    if (!this.statsData) {
        this.loadFromStorage();
    }
    
    // Vérifier qu'on a un payload avec TimePlayedSec
    if (!this.lastPayload || !this.lastPayload.Stats || !this.lastPayload.Stats.TimePlayedSec) {
        console.log('❌ No valid payload with TimePlayedSec available');
        return 'No valid game data available for fix';
    }
    
    const currentTime = Number(this.lastPayload.Stats.TimePlayedSec) || 0;
    const now = new Date();
    
    // Réinitialiser complètement le système de temps en respectant le modèle
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

    

    return module;
})();

// soulframe-stats-module.js - VERSION CORRIGÉE
class SoulframeStatsModule {
  constructor() {
    this.statsData = null;
    this.sessionHistory = [];
    this.greenTagsConfig = { 
      display: true, 
      cumulative: true, 
      daily: true 
    };
    this.refreshMode = 'auto';
    this.lastUpdate = null;
    this.timerInterval = null;
  }

  // Timer System
  initializeTimer(onRefreshCallback, interval = 360000) {
    if (this.refreshMode === 'auto') {
      this.timerInterval = setInterval(onRefreshCallback, interval);
    }
  }

  getTimerDisplay() {
    if (!this.lastUpdate) return "Never updated";
    const now = new Date();
    const diff = Math.floor((now - this.lastUpdate) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `Last: ${minutes}m ${seconds}s ago`;
  }

  setRefreshMode(mode) {
    this.refreshMode = mode;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.saveToStorage();
  }

  // Session Tracking
  trackSession(newData, oldData) {
    if (!oldData) return null;
    
    const session = {
      start: this.lastUpdate || new Date(),
      end: new Date(),
      data: newData,
      duration: new Date() - (this.lastUpdate || new Date())
    };
    
    this.sessionHistory.push(session);
    this.saveToStorage();
    return session;
  }

  // Green Tags Management
  updateGreenTags(newData, oldData) {
    if (!oldData) return {};
    
    const greenTags = {
      weapons: {},
      enemies: {},
      stats: {}
    };

    // Logique simplifiée pour démonstration
    if (newData?.Stats && oldData?.Stats) {
      const newTime = newData.Stats.TimePlayedSec || 0;
      const oldTime = oldData.Stats.TimePlayedSec || 0;
      
      if (newTime > oldTime) {
        greenTags.stats.timePlayed = newTime - oldTime;
      }
    }
    
    return greenTags;
  }

  // Statistics Calculations
  calculateStatistics(currentData, sessionHistory) {
    return {
      hourly: this.calculateHourlyStats(sessionHistory),
      daily: this.calculateDailyStats(sessionHistory),
      weekly: this.calculateWeeklyStats(sessionHistory),
      monthly: this.calculateMonthlyStats(sessionHistory),
      lastUpdated: new Date().toISOString()
    };
  }

  calculateHourlyStats(sessions) {
    // Implémentation simplifiée
    return {
      totalSessions: sessions.length,
      averageDuration: '0h',
      totalKills: 0
    };
  }

  calculateDailyStats(sessions) {
    return {
      totalSessions: sessions.length,
      averageDuration: '0h',
      totalKills: 0
    };
  }

  calculateWeeklyStats(sessions) {
    return {
      totalSessions: sessions.length,
      averageDuration: '0h', 
      totalKills: 0
    };
  }

  calculateMonthlyStats(sessions) {
    return {
      totalSessions: sessions.length,
      averageDuration: '0h',
      totalKills: 0
    };
  }

  // Export functionality
  exportStatistics() {
    if (!this.statsData) {
      alert("Aucune donnée statistique à exporter");
      return;
    }
    
    const dataStr = JSON.stringify(this.statsData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soulframe-statistics.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // UI Components
  renderStatisticsUI() {
    return `
      <div class="stats-container">
        <div class="stats-header mb-6 p-4 bg-amber-900/20 rounded-lg">
          <h3 class="text-2xl font-serif text-amber-200 mb-2">Statistics & Analytics</h3>
          <div class="timer-display text-amber-300/80 text-sm">${this.getTimerDisplay()}</div>
        </div>
        
        <div class="stats-content space-y-4">
          <div class="p-4 bg-amber-900/10 rounded-lg border border-amber-700/30">
            <h4 class="text-lg font-semibold text-amber-300 mb-3">📊 Aperçu des Sessions</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-amber-200/80">Total sessions:</span>
                <span class="text-amber-100 ml-2">${this.sessionHistory.length}</span>
              </div>
              <div>
                <span class="text-amber-200/80">Mode rafraîchissement:</span>
                <span class="text-amber-100 ml-2">${this.refreshMode}</span>
              </div>
            </div>
          </div>

          <div class="p-4 bg-amber-900/10 rounded-lg border border-amber-700/30">
            <h4 class="text-lg font-semibold text-amber-300 mb-3">🔄 Configuration</h4>
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-amber-200/80">Tags verts affichés:</span>
                <span class="text-amber-100">${this.greenTagsConfig.display ? 'Oui' : 'Non'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-amber-200/80">Mode cumulatif:</span>
                <span class="text-amber-100">${this.greenTagsConfig.cumulative ? 'Oui' : 'Non'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-amber-200/80">Journalier:</span>
                <span class="text-amber-100">${this.greenTagsConfig.daily ? 'Oui' : 'Non'}</span>
              </div>
            </div>
          </div>

          <div class="p-4 bg-blue-900/20 rounded-lg border border-blue-700/30">
            <h4 class="text-lg font-semibold text-blue-300 mb-2">🚧 Fonctionnalités à venir</h4>
            <ul class="list-disc list-inside text-blue-200/80 text-sm space-y-1">
              <li>Graphiques de progression détaillés</li>
              <li>Historique complet des sessions de jeu</li>
              <li>Statistiques par heure/jour/semaine/mois</li>
              <li>Comparaison avec les périodes précédentes</li>
              <li>Export avancé des données</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // Storage Management
  saveToStorage() {
    try {
      const data = {
        statsData: this.statsData,
        sessionHistory: this.sessionHistory,
        greenTagsConfig: this.greenTagsConfig,
        refreshMode: this.refreshMode,
        lastUpdate: this.lastUpdate
      };
      localStorage.setItem('soulframe_stats_module', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save stats module data:', e);
    }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('soulframe_stats_module');
      if (saved) {
        const data = JSON.parse(saved);
        this.statsData = data.statsData || null;
        this.sessionHistory = data.sessionHistory || [];
        this.greenTagsConfig = data.greenTagsConfig || { 
          display: true, cumulative: true, daily: true 
        };
        this.refreshMode = data.refreshMode || 'auto';
        this.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
      }
    } catch (e) {
      console.warn('Failed to load stats module data:', e);
    }
  }
}

// Instance globale
window.SoulframeStats = new SoulframeStatsModule();
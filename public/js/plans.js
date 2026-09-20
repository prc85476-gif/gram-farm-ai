// ==========================================================================
// INVESTMENT & MINING PLANS MANAGER (COMPACT 3D CARVED WOOD RPG THEME)
// ==========================================================================

export class PlansManager {
  constructor(app) {
    this.app = app;
    this.plans = [];
    this.init();
  }

  async init() {
    await this.fetchPlans();
  }

  async fetchPlans() {
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      if (data.success) {
        this.plans = data.plans;
        this.renderPlans();
      }
    } catch (e) {
      console.error('Fetch plans error:', e);
    }
  }

  renderPlans() {
    const container = document.getElementById('plans-container');
    if (!container) return;

    const user = this.app.state.user;
    const activePlanIds = (user?.active_plans || []).map(p => p.plan_id);

    container.innerHTML = this.plans.map(plan => {
      const isActive = activePlanIds.includes(plan.id);

      return `
        <div class="wood-plank compact-plan-card">
          <div class="wood-rivet tl"></div>
          <div class="wood-rivet tr"></div>
          <div class="wood-rivet bl"></div>
          <div class="wood-rivet br"></div>

          <!-- Top Row: Icon + Name & Tier + Price Badge -->
          <div class="plan-compact-top">
            <div class="plan-compact-left">
              <div class="wood-oct-socket plan-icon-socket" style="color: ${plan.color};">
                ${this.getPlanSvgIcon(plan.id)}
              </div>
              <div class="plan-title-box">
                <div class="plan-title-row">
                  <h3 class="plan-name-text">${plan.name}</h3>
                  <span class="plan-tier-badge" style="color: ${plan.color}; border-color: ${plan.color}55;">${plan.tier}</span>
                </div>
                <span class="plan-period-sub">${plan.durationDays} Days Contract • ${plan.roiPercent} Total ROI</span>
              </div>
            </div>
            <div class="plan-price-pill" style="border-color: ${plan.color}88; color: ${plan.color};">
              <span class="price-ton-big">${plan.priceGram.toLocaleString()} GRAM</span>
            </div>
          </div>

          <!-- Streamlined Metrics Grid (4 Stats) -->
          <div class="plan-compact-metrics">
            <div class="compact-metric-item">
              <span class="c-label">Daily Mine</span>
              <span class="c-val green">+${plan.dailyProfit} GRAM</span>
            </div>
            <div class="compact-metric-item">
              <span class="c-label">Total Return</span>
              <span class="c-val gold">+${plan.totalReturnGram} GRAM</span>
            </div>
            <div class="compact-metric-item">
              <span class="c-label">Hashrate</span>
              <span class="c-val blue">+${plan.hashrate} GH/s</span>
            </div>
            <div class="compact-metric-item">
              <span class="c-label">Contract</span>
              <span class="c-val cyan">${plan.durationDays} Days</span>
            </div>
          </div>

          <!-- Bottom Action Row -->
          <div class="plan-compact-footer">
            <div class="plan-cost-summary">
              <span class="cost-lbl">Price:</span>
              <span class="cost-val-gram" style="color: #00ff88; font-weight: 900; font-size: 13.5px;">${plan.priceGram.toLocaleString()} GRAM</span>
            </div>

            <div class="plan-btn-wrap">
              ${isActive ? `
                <button class="wood-btn-compact active-status">
                  <svg class="svg-icon check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Active Rig</span>
                </button>
              ` : `
                <button class="wood-btn-compact btn-activate" style="background: linear-gradient(180deg, ${plan.color}ee 0%, ${plan.color}aa 100%);" onclick="window.app.plansManager.openBuyModal('${plan.id}')">
                  <svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                  <span>Activate Rig</span>
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  getPlanSvgIcon(planId) {
    switch (planId) {
      case 'starter_miner_1ton':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`;
      case 'pro_farm_5ton':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
      case 'asic_turbo_10ton':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`;
      case 'quantum_node_25ton':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`;
      default:
        return `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    }
  }

  async openBuyModal(planId) {
    const plan = this.plans.find(p => p.id === planId);
    if (!plan) return;

    const user = this.app.state.user;

    const modalHtml = `
      <div class="wood-plank" style="background: #1e0d04; border: 2.5px solid #a75d27; border-radius: 20px; padding: 20px; width: 100%; max-width: 440px;">
        <div class="wood-rivet tl"></div>
        <div class="wood-rivet tr"></div>
        <div class="wood-rivet bl"></div>
        <div class="wood-rivet br"></div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="wood-oct-socket" style="width: 38px; height: 38px; color: ${plan.color};">
              ${this.getPlanSvgIcon(plan.id)}
            </div>
            <div>
              <h3 style="font-size: 16px; font-weight: 900; color: #fff;">${plan.name}</h3>
              <span style="font-size: 11px; color: ${plan.color}; font-weight: 800;">${plan.tier} • ${plan.durationDays} Days</span>
            </div>
          </div>
          <button class="tc-close-btn" onclick="document.getElementById('buy-plan-modal').classList.remove('active')">✕</button>
        </div>

        <div style="background: #110501; border: 1.5px solid #4a1e07; border-radius: 12px; padding: 12px; margin-bottom: 14px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
            <div>
              <span style="color: #94a3b8; display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;">Daily Yield</span>
              <strong style="color: #00ff88; font-size: 14px;">+${plan.dailyProfit} GRAM/day</strong>
            </div>
            <div>
              <span style="color: #94a3b8; display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;">Total Return</span>
              <strong style="color: #fbbf24; font-size: 14px;">+${plan.totalReturnGram} GRAM (${plan.roiPercent})</strong>
            </div>
            <div>
              <span style="color: #94a3b8; display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;">Hash Power</span>
              <strong style="color: #00d2ff; font-size: 14px;">+${plan.hashrate} GH/s</strong>
            </div>
            <div>
              <span style="color: #94a3b8; display: block; font-size: 10px; font-weight: 800; text-transform: uppercase;">Duration</span>
              <strong style="color: #ffffff; font-size: 14px;">30 Days</strong>
            </div>
          </div>
        </div>

        <div style="background: #180802; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; border: 1px solid #3d1704;">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
            <span style="color: #94a3b8; font-weight: 700;">Deposit Balance (For Rigs):</span>
            <span style="color: #fbbf24; font-weight: 800;">${(user?.deposit_balance || 0).toFixed(2)} GRAM</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 6px;">
            <span style="color: #94a3b8; font-weight: 700;">Available (Mined) GRAM:</span>
            <span style="color: #00d2ff; font-weight: 800;">${(user?.gram_balance || 0).toFixed(2)} GRAM</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; border-top: 1px solid #3d1704; padding-top: 6px;">
            <span style="color: #cbd5e1; font-weight: 800;">Total Purchasing Power:</span>
            <span style="color: #00ff88; font-weight: 900; font-size: 14px;">${((user?.deposit_balance || 0) + (user?.gram_balance || 0)).toFixed(2)} GRAM</span>
          </div>
        </div>

        <button class="wood-btn-compact" style="width: 100%; height: 46px; font-size: 15px; font-weight: 900; background: linear-gradient(180deg, #10b981 0%, #057850 100%); color: #fff; border: 1.5px solid #046c45; border-top: 1.5px solid #6ee7b7; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);" onclick="window.app.plansManager.executeBuy('${plan.id}')">
          <svg class="svg-icon" style="width: 18px; height: 18px;" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Pay ${plan.priceGram.toLocaleString()} GRAM</span>
        </button>
      </div>
    `;

    const modal = document.getElementById('buy-plan-modal');
    if (modal) {
      modal.innerHTML = modalHtml;
      modal.classList.add('active');
    }
  }

  async executeBuy(planId) {
    const modal = document.getElementById('buy-plan-modal');
    modal?.classList.remove('active');

    this.app.showToast('Activating Mining Rig...', 'info');

    try {
      const res = await fetch('/api/plans/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          planId: planId,
          currency: 'GRAM'
        })
      });

      const data = await res.json();
      if (data.success) {
        this.app.state.user = data.user;
        this.app.showToast(data.message, 'success');
        this.renderPlans();
        this.app.renderAllTabs();
      } else {
        this.app.showToast(data.message, 'error');
      }
    } catch (e) {
      console.error('Buy error:', e);
      this.app.showToast('Failed to purchase plan', 'error');
    }
  }
}


// ==========================================================================
// TOP MINING BOX & REAL-TIME MINING TICK ENGINE (ZERO EMOJIS)
// ==========================================================================

export class MiningManager {
  constructor(app) {
    this.app = app;
    this.timer = null;
    this.liveUnclaimed = 0;
    this.setupUI();
    this.startMiningLoop();
  }

  setupUI() {
    const claimBtn = document.getElementById('btn-claim-mining');
    claimBtn?.addEventListener('click', () => this.handleClaim());
  }

  startMiningLoop() {
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      this.tick();
    }, 45); // High-frequency 45ms tick for live crypto mining feel
  }

  tick() {
    const user = this.app.state.user;
    if (!user) return;

    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - user.last_claim_timestamp) / 1000);
    const gramPerSec = user.gram_per_second || (user.daily_yield_gram / 86400);
    const maxCapacity = user.max_storage_gram || (gramPerSec * (user.storage_capacity_hours || 3.0) * 3600);

    this.liveUnclaimed = Math.min(maxCapacity, elapsedSeconds * gramPerSec);
    const storagePercent = maxCapacity > 0 ? Math.min(100, (this.liveUnclaimed / maxCapacity) * 100) : 0;

    const counterEl = document.getElementById('mining-live-counter');
    const storagePercentEl = document.getElementById('storage-percent-text');
    const storageBarEl = document.getElementById('storage-progress-bar');
    const storageValueEl = document.getElementById('storage-capacity-value');
    const claimBtn = document.getElementById('btn-claim-mining');
    const claimBtnAmount = document.getElementById('claim-btn-amount');

    if (counterEl) {
      counterEl.textContent = this.liveUnclaimed.toFixed(7);
    }

    if (storagePercentEl) {
      storagePercentEl.textContent = `${storagePercent.toFixed(1)}%`;
    }

    if (storageBarEl) {
      storageBarEl.style.width = `${storagePercent}%`;
      if (storagePercent >= 100) {
        storageBarEl.style.background = 'linear-gradient(90deg, #f59e0b 0%, #f43f5e 100%)';
      } else {
        storageBarEl.style.background = 'linear-gradient(90deg, #10b981 0%, #00d2ff 70%, #f59e0b 100%)';
      }
    }

    if (storageValueEl) {
      const maxCapDisplay = maxCapacity < 0.1 ? maxCapacity.toFixed(4) : maxCapacity.toFixed(2);
      const liveDisplay = this.liveUnclaimed < 0.1 ? this.liveUnclaimed.toFixed(5) : this.liveUnclaimed.toFixed(2);
      storageValueEl.textContent = `${liveDisplay} / ${maxCapDisplay} GRAM`;
    }

    if (claimBtnAmount) {
      claimBtnAmount.textContent = this.liveUnclaimed > 0.0000001 ? `(+${this.liveUnclaimed.toFixed(5)} GRAM)` : '';
    }

    if (claimBtn) {
      claimBtn.disabled = false;
      if (this.liveUnclaimed < 0.01) {
        claimBtn.style.opacity = '0.9';
      } else {
        claimBtn.style.opacity = '1';
      }
    }
  }

  async handleClaim() {
    const user = this.app.state.user;
    if (!user) return;

    if (this.liveUnclaimed < 0.01) {
      this.app.showToast(`Minimum claim amount is 0.01 GRAM. (Currently: ${this.liveUnclaimed.toFixed(5)} GRAM)`, 'error');
      return;
    }

    const claimBtn = document.getElementById('btn-claim-mining');
    if (claimBtn) claimBtn.disabled = true;

    try {
      const res = await fetch('/api/mine/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.app.state.userId })
      });

      const data = await res.json();
      if (data.success) {
        this.app.state.user = data.user;
        this.triggerClaimBurst(data.claimed);
        this.app.showToast(`Claimed +${data.claimed.toFixed(4)} GRAM to Available Balance!`, 'success');
        this.app.renderAllTabs();
      } else {
        this.app.showToast(data.message || 'Minimum claim amount is 0.01 GRAM', 'error');
      }
    } catch (e) {
      console.error('Claim error:', e);
      this.app.showToast('Network error while claiming', 'error');
    } finally {
      if (claimBtn) claimBtn.disabled = false;
    }
  }

  triggerClaimBurst(amount) {
    const container = document.getElementById('mining-hero-card');
    if (!container) return;

    for (let i = 0; i < 4; i++) {
      const particle = document.createElement('div');
      particle.className = 'claim-burst-particle';
      particle.textContent = `+${(amount / 4).toFixed(4)} GRAM`;
      particle.style.left = `${35 + Math.random() * 30}%`;
      particle.style.top = '50%';
      particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 100}px`);

      container.appendChild(particle);
      setTimeout(() => particle.remove(), 1000);
    }
  }

  updateStatsUI() {
    const user = this.app.state.user;
    if (!user) return;

    const hashrateEl = document.getElementById('hero-hashrate-val');
    const dailyYieldEl = document.getElementById('hero-daily-yield-val');
    const totalMinedEl = document.getElementById('stat-total-mined-val');
    const activeRigsEl = document.getElementById('stat-active-rigs-val');
    const gramBalanceEl = document.getElementById('stat-gram-balance-val');

    if (hashrateEl) hashrateEl.textContent = `${user.current_hashrate} GH/s`;
    if (dailyYieldEl) dailyYieldEl.textContent = `${user.daily_yield_gram.toFixed(2)} GRAM`;
    if (totalMinedEl) totalMinedEl.textContent = `${(user.total_mined || 0).toFixed(4)} GRAM`;
    if (activeRigsEl) activeRigsEl.textContent = `${(user.active_plans || []).length} Active`;
    if (gramBalanceEl) gramBalanceEl.textContent = `${user.gram_balance.toFixed(2)} GRAM`;
  }
}

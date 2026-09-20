import { TonConnectManager } from './ton-connect.js';
import { MiningManager } from './mining.js';
import { PlansManager } from './plans.js';
import { TasksManager } from './tasks.js';
import { WalletManager } from './wallet.js';
import { TechBackground } from './tech-bg.js';
import { MysteryBoxManager } from './mystery-box.js';

class GramApp {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.state = {
      userId: this.getUserId(),
      username: params.get('username') || '',
      firstName: params.get('name') || 'Miner',
      photoUrl: params.get('photo') || '',
      user: null,
      currentTab: 'mining'
    };

    this.initTelegram();
    this.initManagers();
    this.setupNavigation();
    this.fetchUserData();
  }

  getUserId() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('userId')) {
      return params.get('userId');
    }

    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
      return String(window.Telegram.WebApp.initDataUnsafe.user.id);
    }

    let storedId = localStorage.getItem('gram_farm_user_id');
    if (!storedId) {
      storedId = 'user_' + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem('gram_farm_user_id', storedId);
    }
    return storedId;
  }

  initTelegram() {
    const params = new URLSearchParams(window.location.search);
    let refCode = params.get('start') || params.get('ref') || params.get('start_param') || params.get('refCode') || '';

    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor('#040e22');
        tg.setBackgroundColor('#040e22');
      } catch (e) {}

      if (tg.initDataUnsafe?.start_param) {
        refCode = tg.initDataUnsafe.start_param;
      }

      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        if (u.username) this.state.username = u.username;
        if (u.first_name) this.state.firstName = u.first_name;
        if (u.photo_url) this.state.photoUrl = u.photo_url;
      }
    }

    // Sync profile & referral binding to backend
    if (this.state.userId) {
      fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.state.userId,
          first_name: this.state.firstName,
          username: this.state.username,
          photo_url: this.state.photoUrl,
          refCode: refCode || undefined
        })
      }).then(r => r.json()).then(d => {
        if (d.success && d.user) {
          this.state.user = d.user;
          this.updateProfileUI();
          this.updateReferralUI();
          this.mysteryBoxManager?.renderMysteryBoxUI();
        }
      }).catch(() => {});
    }
  }

  async fetchUserData() {
    try {
      const res = await fetch(`/api/user/${this.state.userId}`);
      const data = await res.json();
      if (data.success && data.user) {
        this.state.user = data.user;
        this.updateProfileUI();
        this.tonConnectManager.updateHeaderUI();
        this.renderAllTabs();
      }
    } catch (e) {
      console.error('Fetch user data error:', e);
    }
  }

  initManagers() {
    this.techBg = new TechBackground('tech-cyber-canvas');
    this.tonConnectManager = new TonConnectManager(this);
    this.miningManager = new MiningManager(this);
    this.plansManager = new PlansManager(this);
    this.tasksManager = new TasksManager(this);
    this.walletManager = new WalletManager(this);
    this.mysteryBoxManager = new MysteryBoxManager(this);
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab');
    if (initialTab && document.getElementById(`tab-${initialTab}`)) {
      this.switchTab(initialTab);
    }

    document.getElementById('btn-copy-ref-link')?.addEventListener('click', () => {
      this.copyReferralLink();
    });

    document.getElementById('btn-invite-tg-friends')?.addEventListener('click', () => {
      this.shareTelegramReferral();
    });
  }

  switchTab(tabId) {
    this.state.currentTab = tabId;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-page').forEach(page => {
      page.classList.remove('active');
    });

    const activePage = document.getElementById(`tab-${tabId}`);
    if (activePage) activePage.classList.add('active');

    if (tabId === 'plans') this.plansManager.renderPlans();
    if (tabId === 'tasks') this.tasksManager.fetchTasks();
    if (tabId === 'wallet') this.walletManager.renderWallet();
    if (tabId === 'friends') {
      this.updateReferralUI();
      this.mysteryBoxManager?.renderMysteryBoxUI();
    }
  }

  updateProfileUI() {
    const user = this.state.user;
    const displayName = user?.first_name || this.state.firstName || 'Miner';
    const photo = user?.photo_url || this.state.photoUrl;

    const nameEl = document.getElementById('header-user-name');
    const avatarEl = document.getElementById('header-user-avatar');

    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) {
      if (photo) {
        avatarEl.innerHTML = `<img src="${photo}" alt="${displayName}" class="header-user-img" onerror="this.onerror=null; this.src=''; this.parentElement.textContent='${displayName.charAt(0).toUpperCase()}';">`;
      } else {
        avatarEl.textContent = displayName.charAt(0).toUpperCase();
      }
    }
  }

  updateReferralUI() {
    const user = this.state.user;
    if (!user) return;

    const botUsername = 'gramframaibot';
    const refLink = `https://t.me/${botUsername}?start=ref_${user.referral_code}`;
    const linkInput = document.getElementById('ref-link-display');
    const friendsCount = document.getElementById('ref-friends-count');
    const earningsVal = document.getElementById('ref-earnings-val');

    if (linkInput) linkInput.value = refLink;
    if (friendsCount) friendsCount.textContent = `${user.referrals_count || 0} Friends`;
    if (earningsVal) earningsVal.textContent = `${(user.referral_earnings || 0).toFixed(2)} GRAM`;

    this.mysteryBoxManager?.renderMysteryBoxUI();
  }

  copyReferralLink() {
    const linkInput = document.getElementById('ref-link-display');
    if (linkInput) {
      navigator.clipboard.writeText(linkInput.value);
      this.showToast('Referral link copied to clipboard', 'success');
    }
  }

  shareTelegramReferral() {
    const user = this.state.user;
    const botUsername = 'gramframaibot';
    const refLink = `https://t.me/${botUsername}?start=ref_${user?.referral_code || 'BONUS'}`;
    const text = encodeURIComponent(
      `🚀 Join Gram Farm AI & Cloud Mining on TON!\n⚡ Mine GRAM tokens in real-time with 15 GH/s Starter Bonus.\n🎁 Open Mystery Gift Boxes & earn 10% Lifetime Commission!`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${text}`;
    window.open(shareUrl, '_blank');
  }

  renderAllTabs() {
    this.updateProfileUI();
    this.miningManager.updateStatsUI();
    this.plansManager.renderPlans();
    this.walletManager.renderWallet();
    this.updateReferralUI();
    this.mysteryBoxManager?.renderMysteryBoxUI();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new GramApp();
});

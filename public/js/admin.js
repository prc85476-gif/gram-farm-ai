// ==========================================================================
// GRAM FARM AI - ADMIN DASHBOARD CLIENT CONTROLLER
// ==========================================================================

class AdminDashboard {
  constructor() {
    this.secret = localStorage.getItem('gram_admin_secret') || '';
    this.stats = null;
    this.users = [];
    this.deposits = [];
    this.withdrawals = [];
    this.transactions = [];
    this.giftCodes = [];
    this.currentTab = 'users';
    this.selectedUserId = null;
    this.selectedWithdrawalId = null;
    this.autoRefreshInterval = null;

    this.init();
  }

  init() {
    this.bindEvents();
    if (this.secret) {
      this.checkAuth();
    } else {
      this.showLogin();
    }
  }

  bindEvents() {
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = document.getElementById('admin-pin-input').value.trim();
      this.login(pin);
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      this.logout();
    });

    // Navigation tabs
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Refresh buttons
    document.getElementById('btn-refresh-stats')?.addEventListener('click', () => {
      this.loadAllData(true);
    });
    document.getElementById('btn-sync-db')?.addEventListener('click', () => {
      this.syncDatabase();
    });
    document.getElementById('btn-refresh-gift-codes')?.addEventListener('click', () => {
      this.loadGiftCodes();
    });
    document.getElementById('btn-refresh-deposits')?.addEventListener('click', () => {
      this.loadDeposits();
    });
    document.getElementById('btn-refresh-withdrawals')?.addEventListener('click', () => {
      this.loadWithdrawals();
    });

    // Deposit search
    document.getElementById('deposit-search-input')?.addEventListener('input', (e) => {
      this.renderDepositsTable(e.target.value);
    });

    // Withdrawal filter
    document.getElementById('wd-filter-select')?.addEventListener('change', () => {
      this.renderWithdrawalsTable();
    });

    // Create Gift Code Form
    document.getElementById('create-gift-code-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createGiftCode();
    });

    // Generate Random Code button
    document.getElementById('btn-generate-random-code')?.addEventListener('click', () => {
      this.generateRandomGiftCode();
    });

    // User Search & Filter
    document.getElementById('user-search-input')?.addEventListener('input', (e) => {
      this.renderUsersTable(e.target.value);
    });
    document.getElementById('user-filter-select')?.addEventListener('change', () => {
      this.renderUsersTable();
    });

    // Transactions Filter
    document.getElementById('tx-filter-select')?.addEventListener('change', () => {
      this.renderTransactionsTable();
    });

    // Broadcast form
    document.getElementById('broadcast-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendBroadcast();
    });

    // Modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
  }

  showLogin() {
    document.getElementById('auth-overlay').style.display = 'flex';
  }

  hideLogin() {
    document.getElementById('auth-overlay').style.display = 'none';
  }

  async login(pin) {
    if (!pin) return this.showToast('Please enter Admin PIN', 'error');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: pin })
      });
      const data = await res.json();

      if (data.success) {
        this.secret = pin;
        localStorage.setItem('gram_admin_secret', pin);
        this.hideLogin();
        this.showToast('Admin authenticated successfully!', 'success');
        this.loadAllData();
        this.startAutoRefresh();
      } else {
        this.showToast(data.message || 'Invalid PIN', 'error');
      }
    } catch (e) {
      this.showToast('Connection error', 'error');
    }
  }

  async checkAuth() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-secret': this.secret }
      });
      if (res.ok) {
        this.hideLogin();
        this.loadAllData();
        this.startAutoRefresh();
      } else {
        this.logout();
      }
    } catch (e) {
      this.showLogin();
    }
  }

  logout() {
    this.secret = '';
    localStorage.removeItem('gram_admin_secret');
    if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
    this.showLogin();
  }

  startAutoRefresh() {
    if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
    this.autoRefreshInterval = setInterval(() => {
      this.loadAllData(false);
    }, 15000); // 15 seconds refresh
  }

  async loadAllData(showNotification = false) {
    try {
      await Promise.all([
        this.fetchStats(),
        this.fetchUsers(),
        this.fetchDeposits(),
        this.fetchWithdrawals(),
        this.fetchTransactions(),
        this.fetchGiftCodes()
      ]);
      if (showNotification) {
        this.showToast('Dashboard data refreshed from Neon DB', 'info');
      }
    } catch (err) {
      console.error('Load data error:', err);
    }
  }

  async fetchStats() {
    const res = await fetch('/api/admin/stats', {
      headers: { 'x-admin-secret': this.secret }
    });
    const data = await res.json();
    if (data.success) {
      this.stats = data.stats;
      this.renderStats();
    }
  }

  async fetchUsers() {
    const res = await fetch('/api/admin/users', {
      headers: { 'x-admin-secret': this.secret }
    });
    const data = await res.json();
    if (data.success) {
      this.users = data.users;
      this.renderUsersTable();
    }
  }

  async fetchDeposits() {
    if (!this.secret) return;
    try {
      const res = await fetch('/api/admin/deposits', {
        headers: { 'x-admin-secret': this.secret }
      });
      const data = await res.json();
      if (data.success) {
        this.deposits = data.deposits || [];
        this.renderDepositsTable();
      }
    } catch (err) {
      console.error('Fetch deposits error:', err);
    }
  }

  async loadDeposits() {
    try {
      await this.fetchDeposits();
      this.showToast('Deposits ledger refreshed', 'info');
    } catch (e) {
      this.showToast('Failed to refresh deposits', 'error');
    }
  }

  async fetchWithdrawals() {
    if (!this.secret) return;
    try {
      const res = await fetch('/api/admin/withdrawals', {
        headers: { 'x-admin-secret': this.secret }
      });
      const data = await res.json();
      if (data.success) {
        this.withdrawals = data.withdrawals || [];
        this.renderWithdrawalsTable();
        this.renderStats();
      }
    } catch (err) {
      console.error('Fetch withdrawals error:', err);
    }
  }

  async loadWithdrawals() {
    try {
      await this.fetchWithdrawals();
      this.showToast('Withdrawals queue refreshed', 'info');
    } catch (e) {
      this.showToast('Failed to refresh withdrawals', 'error');
    }
  }

  async fetchTransactions() {
    const res = await fetch('/api/admin/transactions', {
      headers: { 'x-admin-secret': this.secret }
    });
    const data = await res.json();
    if (data.success) {
      this.transactions = data.transactions;
      this.renderTransactionsTable();
    }
  }

  renderStats() {
    if (!this.stats) return;

    document.getElementById('stat-total-users').innerText = this.stats.totalUsers.toLocaleString();
    document.getElementById('stat-total-balance').innerText = `${this.stats.totalGramBalance.toLocaleString()} GRAM`;
    document.getElementById('stat-total-mined').innerText = `${this.stats.totalMined.toLocaleString()} GRAM`;
    document.getElementById('stat-total-deposits').innerText = `${this.stats.totalDeposited.toLocaleString()} GRAM`;
    document.getElementById('stat-total-withdrawals').innerText = `${this.stats.totalWithdrawn.toLocaleString()} GRAM`;
    document.getElementById('stat-network-hashrate').innerText = `${this.stats.totalNetworkHashrate.toLocaleString()} GH/s (${this.stats.totalActiveRigs} Active Rigs)`;
    document.getElementById('stat-total-boxes').innerText = `${this.stats.totalMysteryBoxesOpened} Mystery Drops`;

    // Render Withdrawals KPI Metrics
    const withdrawals = this.withdrawals || [];
    const pendingWds = withdrawals.filter(w => w.status === 'PENDING');
    const pendingCount = pendingWds.length;
    const pendingAmt = pendingWds.reduce((sum, w) => sum + (w.amount || 0), 0);
    const completedWds = withdrawals.filter(w => w.status === 'COMPLETED' || w.status === 'APPROVED');
    const completedAmt = completedWds.reduce((sum, w) => sum + (w.amount || 0), 0);
    const rejectedCount = withdrawals.filter(w => w.status === 'REJECTED').length;

    const elWdPendingCount = document.getElementById('stat-wd-pending-count');
    const elWdPendingAmt = document.getElementById('stat-wd-pending-amount');
    const elWdCompAmt = document.getElementById('stat-wd-completed-amount');
    const elWdRejCount = document.getElementById('stat-wd-rejected-count');
    const elSidebarWdBadge = document.getElementById('sidebar-pending-withdrawals-badge');

    if (elWdPendingCount) elWdPendingCount.innerText = pendingCount.toLocaleString();
    if (elWdPendingAmt) elWdPendingAmt.innerText = `${pendingAmt.toFixed(2)} GRAM`;
    if (elWdCompAmt) elWdCompAmt.innerText = `${completedAmt.toFixed(2)} GRAM`;
    if (elWdRejCount) elWdRejCount.innerText = rejectedCount.toLocaleString();

    if (elSidebarWdBadge) {
      if (pendingCount > 0) {
        elSidebarWdBadge.innerText = pendingCount;
        elSidebarWdBadge.style.display = 'inline-block';
      } else {
        elSidebarWdBadge.style.display = 'none';
      }
    }

    // Render Gift Codes Top KPI cards
    const codes = this.giftCodes || [];
    const totalClaimed = codes.reduce((sum, c) => sum + (c.claims_count || 0), 0);
    const totalMax = codes.reduce((sum, c) => sum + (c.max_claims || 0), 0);
    const totalRemaining = Math.max(0, totalMax - totalClaimed);
    const totalDistributed = codes.reduce((sum, c) => sum + ((c.claims_count || 0) * (c.reward_gram || 0)), 0);

    const elTotalCodes = document.getElementById('stat-gift-total-codes');
    const elTotalClaimed = document.getElementById('stat-gift-total-claimed');
    const elTotalRemaining = document.getElementById('stat-gift-total-remaining');
    const elTotalDist = document.getElementById('stat-gift-total-distributed');

    if (elTotalCodes) elTotalCodes.innerText = codes.length.toLocaleString();
    if (elTotalClaimed) elTotalClaimed.innerText = `${totalClaimed.toLocaleString()} Users`;
    if (elTotalRemaining) elTotalRemaining.innerText = `${totalRemaining.toLocaleString()} Slots`;
    if (elTotalDist) elTotalDist.innerText = `${totalDistributed.toFixed(2)} GRAM`;

    // Render Tier Distribution breakdown
    const tierContainer = document.getElementById('tier-distribution-list');
    if (tierContainer && this.stats.tierBreakdown) {
      tierContainer.innerHTML = Object.entries(this.stats.tierBreakdown).map(([id, info]) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="font-size: 14px; font-weight: 800; color: #ffffff;">${info.name}</h4>
            <span style="font-size: 12px; color: var(--accent-cyan); font-weight: 600;">Total Power: ${info.hashrate} GH/s</span>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-blue" style="font-size: 12.5px; padding: 6px 14px;">${info.count} Active</span>
          </div>
        </div>
      `).join('');
    }
  }

  renderUsersTable(searchQuery = '') {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const query = searchQuery.toLowerCase().trim() || (document.getElementById('user-search-input')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('user-filter-select')?.value || 'all';

    let filtered = this.users.filter(u => {
      const matchQuery = 
        u.id.toLowerCase().includes(query) ||
        (u.first_name || '').toLowerCase().includes(query) ||
        (u.username || '').toLowerCase().includes(query) ||
        (u.ton_wallet_address || '').toLowerCase().includes(query);

      if (!matchQuery) return false;

      if (filter === 'active_plans') return u.active_plans_count > 0;
      if (filter === 'wallet_connected') return !!u.ton_wallet_address;
      if (filter === 'has_balance') return u.gram_balance > 0;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No miners found matching query</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const avatarHtml = u.photo_url 
        ? `<img src="${u.photo_url}" alt="Avatar">`
        : (u.first_name ? u.first_name.charAt(0).toUpperCase() : 'M');

      const walletDisplay = u.ton_wallet_address 
        ? `<span class="badge badge-blue" title="${u.ton_wallet_address}">${u.ton_wallet_address.substring(0, 4)}...${u.ton_wallet_address.slice(-4)}</span>`
        : `<span style="color: var(--text-muted); font-size: 11px;">Not Linked</span>`;

      return `
        <tr>
          <td><strong style="color: var(--accent-cyan); font-size: 13px; font-family: var(--font-mono);">#${u.id}</strong></td>
          <td>
            <div class="user-cell">
              <div class="user-avatar">${avatarHtml}</div>
              <div class="user-names">
                <h4>${u.first_name || 'Miner'}</h4>
                <span>${u.username ? '@' + u.username : 'ID: ' + u.id}</span>
                <div style="font-size: 10.5px; color: var(--accent-cyan); margin-top: 3px; font-weight: 600;">
                  Code: <code style="color: #67e8f9;">${u.referral_code || 'N/A'}</code>
                  ${u.referred_by ? `<span style="color: var(--text-muted); margin-left: 6px;">(by #${u.referred_by})</span>` : ''}
                </div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size: 11px; color: var(--text-secondary);">Available (Mined):</div>
            <strong style="color: var(--accent-emerald); font-size: 13.5px;">${u.gram_balance.toFixed(2)} GRAM</strong>
            <div style="font-size: 11px; color: var(--accent-amber); margin-top: 3px;">Deposit (Hardware): +${(u.deposit_balance || 0).toFixed(2)} GRAM</div>
          </td>
          <td>
            <span class="badge badge-purple">${u.current_hashrate} GH/s</span>
            <div style="font-size: 11px; color: var(--accent-cyan); font-weight: 700; margin-top: 3px;">
              👥 ${u.referrals_count || 0} Referrals
            </div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">🎁 ${u.mystery_boxes_available || 0} Boxes</div>
          </td>
          <td>
            <div style="font-size: 12px; color: var(--accent-emerald); font-weight: 700;">In: +${u.total_deposited.toFixed(2)} GRAM</div>
            <div style="font-size: 12px; color: var(--accent-rose); font-weight: 700;">Out: -${u.total_withdrawn.toFixed(2)} GRAM</div>
          </td>
          <td>${walletDisplay}</td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn-admin btn-ghost" style="padding: 6px 10px; font-size: 11.5px;" onclick="window.admin.openBalanceModal('${u.id}', '${u.first_name || u.id}', ${u.gram_balance}, ${u.deposit_balance || 0})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v12M6 12h12"></path></svg>
                <span>Balance</span>
              </button>
              <button class="btn-admin btn-ghost" style="padding: 6px 10px; font-size: 11.5px;" onclick="window.admin.openGiftPlanModal('${u.id}', '${u.first_name || u.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>
                <span>Gift Rig</span>
              </button>
              <button class="btn-admin btn-ghost" style="padding: 6px 10px; font-size: 11.5px;" onclick="window.admin.giftBoxes('${u.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line></svg>
                <span>+Drop</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderTransactionsTable() {
    const tbody = document.getElementById('tx-table-body');
    if (!tbody) return;

    const filter = document.getElementById('tx-filter-select')?.value || 'all';

    let filtered = this.transactions.filter(tx => {
      if (filter === 'all') return true;
      if (filter === 'DEPOSIT') return tx.type === 'DEPOSIT';
      if (filter === 'WITHDRAW') return tx.type === 'WITHDRAW';
      if (filter === 'PLAN_PURCHASE') return tx.type === 'PLAN_PURCHASE';
      if (filter === 'BONUS') return tx.type.includes('BONUS') || tx.type.includes('GIFT');
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No ledger records found</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(tx => {
      const isPositive = tx.isPositive !== false && !tx.amount.startsWith('-');
      const colorClass = isPositive ? 'var(--accent-emerald)' : 'var(--accent-rose)';
      const dateStr = new Date(tx.timestamp).toLocaleString();

      let badgeClass = 'badge-blue';
      if (tx.type === 'DEPOSIT') badgeClass = 'badge-green';
      if (tx.type === 'WITHDRAW') badgeClass = 'badge-red';
      if (tx.type === 'PLAN_PURCHASE') badgeClass = 'badge-purple';
      if (tx.type.includes('GIFT') || tx.type.includes('BONUS')) badgeClass = 'badge-gold';

      return `
        <tr>
          <td><strong style="color: #ffffff; font-size: 12px; font-family: var(--font-mono);">${tx.id}</strong></td>
          <td>
            <div style="font-weight: 700; color: #ffffff;">${tx.userName || tx.userId}</div>
            <span style="font-size: 11px; color: var(--text-secondary);">ID: ${tx.userId}</span>
          </td>
          <td><span class="badge ${badgeClass}">${tx.type}</span></td>
          <td>
            <div style="font-weight: 800; color: ${colorClass}; font-size: 13.5px;">${tx.amount}</div>
            <span style="font-size: 11px; color: var(--text-secondary);">${tx.title || ''}</span>
          </td>
          <td>
            <span class="badge badge-green">${tx.status || 'Completed'}</span>
            ${tx.txHash ? `<div style="font-size: 10px; color: var(--accent-cyan); font-family: var(--font-mono); margin-top: 3px;">Hash: ${tx.txHash.substring(0, 12)}...</div>` : ''}
          </td>
          <td style="font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }

  renderDepositsTable(searchQuery = '') {
    const tbody = document.getElementById('deposits-table-body');
    if (!tbody) return;

    const query = searchQuery.toLowerCase().trim() || (document.getElementById('deposit-search-input')?.value || '').toLowerCase().trim();

    let filtered = this.deposits.filter(d => {
      if (!query) return true;
      return (
        d.id.toLowerCase().includes(query) ||
        d.userId.toLowerCase().includes(query) ||
        (d.userName || '').toLowerCase().includes(query) ||
        (d.userUsername || '').toLowerCase().includes(query) ||
        (d.sender || '').toLowerCase().includes(query) ||
        (d.txHash || '').toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 35px; color: var(--text-muted);">No verified deposits found matching query</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(d => {
      const avatarHtml = d.userAvatar 
        ? `<img src="${d.userAvatar}" alt="Avatar">`
        : (d.userName ? d.userName.charAt(0).toUpperCase() : 'M');

      const dateStr = d.timestamp ? new Date(d.timestamp).toLocaleString() : 'N/A';
      const senderShort = d.sender && d.sender.length > 10 ? `${d.sender.substring(0, 6)}...${d.sender.slice(-4)}` : (d.sender || 'Tonkeeper');

      let tonscanLinkHtml = '';
      if (d.txHash) {
        const explorerUrl = d.explorerUrl || `https://tonviewer.com/transaction/${encodeURIComponent(d.txHash)}`;
        const shortHash = d.txHash.length > 14 ? `${d.txHash.substring(0, 8)}...${d.txHash.slice(-6)}` : d.txHash;

        tonscanLinkHtml = `
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="btn-tonscan-link" title="Open on TON Scan / Tonviewer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>View on TON Scan ↗</span>
            </a>
            <div style="display: flex; align-items: center; gap: 5px; font-size: 11px; font-family: var(--font-mono); color: var(--accent-cyan);">
              <span>${shortHash}</span>
              <button class="btn-admin btn-ghost" style="padding: 2px 6px; font-size: 10px;" title="Copy Full Tx Hash" onclick="navigator.clipboard.writeText('${d.txHash}').then(() => window.admin.showToast('Tx Hash copied: ${d.txHash}', 'success'))">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 10px; height: 10px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </div>
        `;
      } else {
        tonscanLinkHtml = `<span style="color: var(--text-muted); font-size: 11px;">Internal Deposit</span>`;
      }

      return `
        <tr>
          <td><strong style="color: #ffffff; font-size: 12px; font-family: var(--font-mono);">${d.id}</strong></td>
          <td>
            <div class="user-cell">
              <div class="user-avatar">${avatarHtml}</div>
              <div class="user-names">
                <h4>${d.userName}</h4>
                <span>${d.userUsername ? '@' + d.userUsername : 'ID: ' + d.userId}</span>
              </div>
            </div>
          </td>
          <td>
            <strong style="color: var(--accent-emerald); font-size: 14px; font-weight: 800;">+${d.amountGram.toFixed(2)} GRAM</strong>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge badge-blue" style="font-family: var(--font-mono);">${senderShort}</span>
              <button class="btn-admin btn-ghost" style="padding: 3px 6px; font-size: 10px;" title="Copy Sender Address" onclick="navigator.clipboard.writeText('${d.sender}').then(() => window.admin.showToast('Sender address copied', 'success'))">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 11px; height: 11px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </td>
          <td>${tonscanLinkHtml}</td>
          <td>
            <span class="badge badge-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 12px; height: 12px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Verified
            </span>
          </td>
          <td style="font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }

  renderWithdrawalsTable() {
    const tbody = document.getElementById('withdrawals-table-body');
    if (!tbody) return;

    const filter = document.getElementById('wd-filter-select')?.value || 'all';

    let filtered = this.withdrawals.filter(w => {
      if (filter === 'all') return true;
      if (filter === 'PENDING') return w.status === 'PENDING';
      if (filter === 'COMPLETED') return w.status === 'COMPLETED' || w.status === 'APPROVED';
      if (filter === 'REJECTED') return w.status === 'REJECTED';
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 35px; color: var(--text-muted);">No withdrawal requests found</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(w => {
      const avatarHtml = w.userAvatar 
        ? `<img src="${w.userAvatar}" alt="Avatar">`
        : (w.userName ? w.userName.charAt(0).toUpperCase() : 'M');

      const dateStr = w.createdAt ? new Date(w.createdAt).toLocaleString() : 'N/A';
      const destShort = w.destination && w.destination.length > 10 ? `${w.destination.substring(0, 6)}...${w.destination.slice(-4)}` : (w.destination || 'Not Linked');

      let statusBadge = '';
      if (w.status === 'PENDING') {
        statusBadge = `<span class="badge badge-gold" style="box-shadow: 0 0 12px rgba(245,158,11,0.25);"><span class="status-dot" style="background:var(--accent-amber);box-shadow:0 0 8px var(--accent-amber);width:6px;height:6px;"></span> PENDING</span>`;
      } else if (w.status === 'COMPLETED' || w.status === 'APPROVED') {
        statusBadge = `<span class="badge badge-green"><span class="status-dot" style="background:var(--accent-emerald);box-shadow:none;width:6px;height:6px;"></span> COMPLETED</span>`;
      } else if (w.status === 'REJECTED') {
        statusBadge = `<span class="badge badge-red"><span class="status-dot" style="background:var(--accent-rose);box-shadow:none;width:6px;height:6px;"></span> REJECTED</span>`;
      }

      let txDisplay = '';
      if (w.txHash) {
        const explorerUrl = w.explorerUrl || `https://tonviewer.com/transaction/${encodeURIComponent(w.txHash)}`;
        const shortHash = w.txHash.length > 14 ? `${w.txHash.substring(0, 8)}...${w.txHash.slice(-6)}` : w.txHash;
        txDisplay = `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="btn-tonscan-link" style="padding: 4px 10px; font-size: 11px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 12px; height: 12px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>TON Scan ↗</span>
            </a>
            <span style="font-size: 10px; font-family: var(--font-mono); color: var(--accent-cyan);">${shortHash}</span>
          </div>
        `;
      } else if (w.status === 'PENDING') {
        txDisplay = `<span style="color: var(--accent-amber); font-size: 11.5px; font-weight: 700;">Awaiting Payout</span>`;
      } else if (w.status === 'REJECTED') {
        txDisplay = `<span style="color: var(--accent-rose); font-size: 11.5px;">${w.note || 'Refunded'}</span>`;
      } else {
        txDisplay = `<span style="color: var(--text-muted); font-size: 11px;">Paid On-Chain</span>`;
      }

      let actionsHtml = '';
      if (w.status === 'PENDING') {
        actionsHtml = `
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn-admin btn-success" style="padding: 6px 12px; font-size: 11.5px;" onclick="window.admin.openApproveWithdrawalModal('${w.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 12px; height: 12px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Approve / Pay</span>
            </button>
            <button class="btn-admin btn-danger" style="padding: 6px 10px; font-size: 11.5px;" onclick="window.admin.openRejectWithdrawalModal('${w.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 12px; height: 12px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span>Reject</span>
            </button>
          </div>
        `;
      } else if (w.status === 'COMPLETED' || w.status === 'APPROVED') {
        actionsHtml = `<span style="color: var(--accent-emerald); font-size: 12px; font-weight: 700;">Paid</span>`;
      } else {
        actionsHtml = `<span style="color: var(--accent-rose); font-size: 12px; font-weight: 700;">Refunded</span>`;
      }

      return `
        <tr>
          <td><strong style="color: #ffffff; font-size: 12px; font-family: var(--font-mono);">${w.id}</strong></td>
          <td>
            <div class="user-cell">
              <div class="user-avatar">${avatarHtml}</div>
              <div class="user-names">
                <h4>${w.userName}</h4>
                <span>${w.userUsername ? '@' + w.userUsername : 'ID: ' + w.userId}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="badge badge-blue" style="font-family: var(--font-mono);" title="${w.destination}">${destShort}</span>
              <button class="btn-admin btn-ghost" style="padding: 3px 6px; font-size: 10px;" title="Copy Destination TON Address" onclick="navigator.clipboard.writeText('${w.destination}').then(() => window.admin.showToast('Destination wallet copied', 'success'))">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 11px; height: 11px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </td>
          <td>
            <strong style="color: var(--accent-rose); font-size: 14px; font-weight: 800;">-${w.amount.toFixed(2)} GRAM</strong>
          </td>
          <td>${statusBadge}</td>
          <td>${txDisplay}</td>
          <td style="font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join('');
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-pane-${tabId}`);
    });
    if (tabId === 'gift-codes') {
      this.fetchGiftCodes();
    }
    if (tabId === 'deposits') {
      this.fetchDeposits();
    }
    if (tabId === 'withdrawals') {
      this.fetchWithdrawals();
    }
  }

  openApproveWithdrawalModal(withdrawalId) {
    this.selectedWithdrawalId = withdrawalId;
    const wd = this.withdrawals.find(w => w.id === withdrawalId);
    if (!wd) return this.showToast('Withdrawal request not found', 'error');

    const infoEl = document.getElementById('modal-approve-info');
    if (infoEl) {
      infoEl.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Miner:</strong> ${wd.userName} (ID: <span style="font-family:var(--font-mono);color:var(--accent-cyan);">${wd.userId}</span>)</div>
        <div style="margin-bottom: 4px;"><strong>Requested Payout:</strong> <span style="color:var(--accent-emerald); font-weight:800; font-size:14px;">${wd.amount.toFixed(2)} GRAM (TON)</span></div>
        <div><strong>Destination Wallet:</strong> <span style="color:var(--accent-cyan); font-family:var(--font-mono); font-size:12px; word-break:break-all;">${wd.destination}</span></div>
      `;
    }
    document.getElementById('approve-txhash-input').value = '';
    document.getElementById('approve-note-input').value = '';
    document.getElementById('approve-withdrawal-modal').classList.add('active');
  }

  async submitApproveWithdrawal() {
    if (!this.selectedWithdrawalId) return;
    const txHash = document.getElementById('approve-txhash-input').value.trim();
    const note = document.getElementById('approve-note-input').value.trim();

    try {
      const res = await fetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({
          withdrawalId: this.selectedWithdrawalId,
          txHash,
          note
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeAllModals();
        this.fetchWithdrawals();
        this.fetchStats();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to approve withdrawal', 'error');
    }
  }

  openRejectWithdrawalModal(withdrawalId) {
    this.selectedWithdrawalId = withdrawalId;
    const wd = this.withdrawals.find(w => w.id === withdrawalId);
    if (!wd) return this.showToast('Withdrawal request not found', 'error');

    const infoEl = document.getElementById('modal-reject-info');
    if (infoEl) {
      infoEl.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Miner:</strong> ${wd.userName} (ID: <span style="font-family:var(--font-mono);color:var(--accent-cyan);">${wd.userId}</span>)</div>
        <div><strong>Refund Amount:</strong> <span style="color:var(--accent-rose); font-weight:800; font-size:14px;">+${wd.amount.toFixed(2)} GRAM</span> (Will be returned to user Available Balance)</div>
      `;
    }
    document.getElementById('reject-reason-input').value = 'Invalid wallet or memo';
    document.getElementById('reject-withdrawal-modal').classList.add('active');
  }

  async submitRejectWithdrawal() {
    if (!this.selectedWithdrawalId) return;
    const reason = document.getElementById('reject-reason-input').value.trim();

    try {
      const res = await fetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({
          withdrawalId: this.selectedWithdrawalId,
          reason
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeAllModals();
        this.fetchWithdrawals();
        this.fetchStats();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to reject withdrawal', 'error');
    }
  }

  openBalanceModal(userId, name, currentBalance = 0, depositBalance = 0) {
    this.selectedUserId = userId;
    document.getElementById('modal-balance-user-info').innerText = `Miner: ${name} (ID: ${userId}) • Available: ${currentBalance.toFixed(2)} GRAM • Deposit: ${depositBalance.toFixed(2)} GRAM`;
    document.getElementById('balance-amount-input').value = '';
    document.getElementById('balance-modal').classList.add('active');
  }

  async submitBalanceAdjustment() {
    const amount = parseFloat(document.getElementById('balance-amount-input').value);
    const type = document.getElementById('balance-action-type').value;
    const balanceType = document.getElementById('balance-target-type')?.value || 'available';
    const note = document.getElementById('balance-note-input').value.trim();

    if (isNaN(amount) || amount <= 0) {
      return this.showToast('Please enter a valid amount', 'error');
    }

    try {
      const res = await fetch('/api/admin/user/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({
          userId: this.selectedUserId,
          amount,
          type,
          balanceType,
          note
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeAllModals();
        this.loadAllData();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to adjust balance', 'error');
    }
  }

  openGiftPlanModal(userId, name) {
    this.selectedUserId = userId;
    document.getElementById('modal-gift-user-info').innerText = `Recipient Miner: ${name} (ID: ${userId})`;
    document.getElementById('gift-plan-modal').classList.add('active');
  }

  async submitGiftPlan() {
    const planId = document.getElementById('gift-plan-select').value;
    try {
      const res = await fetch('/api/admin/user/gift-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({
          userId: this.selectedUserId,
          planId
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeAllModals();
        this.loadAllData();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to gift plan', 'error');
    }
  }

  async giftBoxes(userId, toAll = false) {
    const count = prompt(`How many Mystery Boxes would you like to gift to ${toAll ? 'ALL miners' : 'miner #' + userId}?`, '1');
    if (!count || isNaN(parseInt(count)) || parseInt(count) <= 0) return;

    try {
      const res = await fetch('/api/admin/user/gift-box', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({
          userId,
          count: parseInt(count),
          toAll
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadAllData();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to gift boxes', 'error');
    }
  }

  async sendBroadcast() {
    const message = document.getElementById('broadcast-message-input').value.trim();
    if (!message) return this.showToast('Message cannot be empty', 'error');

    if (!confirm('Are you sure you want to broadcast this announcement to all Telegram bot users?')) return;

    this.showToast('Sending broadcast...', 'info');

    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        document.getElementById('broadcast-message-input').value = '';
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Broadcast failed', 'error');
    }
  }

  async syncDatabase() {
    this.showToast('Syncing with Neon PostgreSQL...', 'info');
    try {
      const res = await fetch('/api/admin/sync-db', {
        method: 'POST',
        headers: { 'x-admin-secret': this.secret }
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadAllData();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('DB sync failed', 'error');
    }
  }

  // ==========================================
  // GIFT CODES METHODS (WITH REMAINING / CLAIMED STATS)
  // ==========================================
  async fetchGiftCodes() {
    if (!this.secret) return;
    try {
      const res = await fetch('/api/admin/gift-codes', {
        headers: { 'x-admin-secret': this.secret }
      });
      const data = await res.json();
      if (data.success) {
        this.giftCodes = data.giftCodes || [];
        this.renderGiftCodesTable();
        this.renderStats(); // Update top KPI cards
      }
    } catch (err) {
      console.error('Error fetching gift codes:', err);
    }
  }

  async loadGiftCodes() {
    try {
      await this.fetchGiftCodes();
      this.showToast('Gift codes refreshed', 'info');
    } catch (e) {
      this.showToast('Failed to load gift codes', 'error');
    }
  }

  renderGiftCodesTable() {
    const tbody = document.getElementById('gift-codes-table-body');
    if (!tbody) return;

    if (!this.giftCodes || this.giftCodes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 35px; color: var(--text-muted);">No promo gift codes deployed yet. Create one above!</td></tr>`;
      return;
    }

    tbody.innerHTML = this.giftCodes.map(gc => {
      const claimsCount = gc.claims_count || 0;
      const maxClaims = gc.max_claims || 1;
      const remaining = Math.max(0, maxClaims - claimsCount);
      const percent = Math.min(100, Math.round((claimsCount / maxClaims) * 100));
      const isCompleted = claimsCount >= maxClaims;

      let statusBadge = '';
      if (!gc.is_active) {
        statusBadge = `<span class="badge badge-red"><span class="status-dot" style="background:var(--accent-rose);box-shadow:none;width:6px;height:6px;"></span> Paused</span>`;
      } else if (isCompleted) {
        statusBadge = `<span class="badge badge-purple"><span class="status-dot" style="background:var(--accent-purple);box-shadow:none;width:6px;height:6px;"></span> Completed</span>`;
      } else {
        statusBadge = `<span class="badge badge-green"><span class="status-dot" style="background:var(--accent-emerald);box-shadow:none;width:6px;height:6px;"></span> Active</span>`;
      }
      
      const dateStr = gc.created_at ? new Date(gc.created_at).toLocaleString() : 'N/A';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: var(--accent-cyan); font-size: 14px; font-family: var(--font-mono); letter-spacing: 1px;">${gc.code}</strong>
              <button class="btn-admin btn-ghost" style="padding: 4px 8px; font-size: 11px;" title="Copy Code" onclick="navigator.clipboard.writeText('${gc.code}').then(() => window.admin.showToast('Code copied: ${gc.code}', 'success'))">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </td>
          <td><strong style="color: var(--accent-emerald); font-size: 14px; font-weight: 800;">+${Number(gc.reward_gram).toFixed(2)} GRAM</strong></td>
          <td>
            <div style="min-width: 220px;">
              <div style="display: flex; gap: 10px; font-size: 12px; margin-bottom: 5px; align-items: center;">
                <span style="color: var(--accent-emerald); font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5"></path></svg>
                  Claimed: <strong>${claimsCount}</strong>
                </span>
                <span style="color: var(--accent-amber); font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Remaining: <strong>${remaining}</strong>
                </span>
                <span style="color: var(--text-muted); font-size: 11px;">(Max: ${maxClaims})</span>
              </div>
              <div class="progress-bar-wrap" style="width: 100%; height: 7px; background: rgba(255,255,255,0.06);">
                <div class="progress-bar-fill" style="width: ${percent}%;"></div>
              </div>
              <div style="font-size: 10.5px; color: var(--text-secondary); margin-top: 4px; display: flex; justify-content: space-between;">
                <span>${percent}% Claimed</span>
                <span>${remaining} slots left</span>
              </div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td style="font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-admin btn-ghost" style="padding: 6px 12px; font-size: 12px;" onclick="window.admin.toggleGiftCode('${gc.id}', ${!gc.is_active})">
                ${gc.is_active 
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause` 
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Resume`}
              </button>
              <button class="btn-admin btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="window.admin.deleteGiftCode('${gc.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 13px; height: 13px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                <span>Delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  generateRandomGiftCode() {
    const prefixes = ['GRAM', 'FARM', 'BONUS', 'TURBO', 'MINE', 'VIP', 'REWARD'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const input = document.getElementById('gift-code-name-input');
    if (input) {
      input.value = `${prefix}-${randomSuffix}`;
    }
  }

  async createGiftCode() {
    const code = document.getElementById('gift-code-name-input').value.trim();
    const rewardGram = parseFloat(document.getElementById('gift-code-amount-input').value);
    const maxClaims = parseInt(document.getElementById('gift-code-limit-input').value, 10);

    if (!code) return this.showToast('Please enter a Gift Code name', 'error');
    if (isNaN(rewardGram) || rewardGram <= 0) return this.showToast('Reward must be a positive number', 'error');
    if (isNaN(maxClaims) || maxClaims <= 0) return this.showToast('Claim limit must be at least 1', 'error');

    try {
      const res = await fetch('/api/admin/gift-codes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({
          code,
          rewardGram,
          maxClaims
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        document.getElementById('create-gift-code-form').reset();
        document.getElementById('gift-code-limit-input').value = '100';
        this.fetchGiftCodes();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to create gift code', 'error');
    }
  }

  async toggleGiftCode(codeId, isActive) {
    try {
      const res = await fetch('/api/admin/gift-codes/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({ codeId, isActive })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.fetchGiftCodes();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to update gift code status', 'error');
    }
  }

  async deleteGiftCode(codeId) {
    if (!confirm('Are you sure you want to permanently delete this gift code?')) return;

    try {
      const res = await fetch('/api/admin/gift-codes/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': this.secret
        },
        body: JSON.stringify({ codeId })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.fetchGiftCodes();
      } else {
        this.showToast(data.message, 'error');
      }
    } catch (e) {
      this.showToast('Failed to delete gift code', 'error');
    }
  }

  closeAllModals() {
    document.querySelectorAll('.admin-modal-overlay').forEach(m => m.classList.remove('active'));
    this.selectedUserId = null;
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.innerText = message;
    toast.className = `admin-toast show ${type}`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.admin = new AdminDashboard();
});


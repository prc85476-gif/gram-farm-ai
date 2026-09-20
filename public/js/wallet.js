// ==========================================================================
// WALLET & USER PROFILE MANAGER (TELEGRAM IDENTITY, STATS & HISTORY)
// ==========================================================================

export class WalletManager {
  constructor(app) {
    this.app = app;
    this.setupUI();
  }

  setupUI() {
    const depositBtn = document.getElementById('btn-wallet-deposit');
    const withdrawBtn = document.getElementById('btn-wallet-withdraw');
    const copyUidBtn = document.getElementById('btn-copy-uid');
    const walletToggleBtn = document.getElementById('btn-profile-wallet-action');

    depositBtn?.addEventListener('click', () => this.openDepositModal());
    withdrawBtn?.addEventListener('click', () => this.openWithdrawModal());
    
    copyUidBtn?.addEventListener('click', () => {
      const user = this.app.state.user;
      if (user?.id) {
        navigator.clipboard.writeText(String(user.id));
        this.app.showToast(`Copied UID: ${user.id}`, 'success');
      }
    });

    walletToggleBtn?.addEventListener('click', () => {
      const user = this.app.state.user;
      if (user?.ton_wallet_address) {
        this.app.tonConnectManager.disconnectWallet();
      } else {
        this.app.tonConnectManager.openWalletSelectionModal();
      }
    });
  }

  renderWallet() {
    const user = this.app.state.user;
    if (!user) return;

    const displayName = user.first_name || this.app.state.firstName || 'Miner';
    const username = user.username ? `@${user.username}` : (this.app.state.username ? `@${this.app.state.username}` : '@miner_user');
    const uid = user.id || this.app.state.userId || '10001';
    const photo = user.photo_url || this.app.state.photoUrl;

    // Elements
    const avatarEl = document.getElementById('profile-page-avatar');
    const nameEl = document.getElementById('profile-page-name');
    const usernameEl = document.getElementById('profile-page-username');
    const uidEl = document.getElementById('profile-page-uid');
    const walletAddrEl = document.getElementById('wallet-page-address');
    const walletToggleBtn = document.getElementById('btn-profile-wallet-action');

    const availBalEl = document.getElementById('profile-available-bal');
    const tonBalEl = document.getElementById('profile-ton-bal');
    const totalDepEl = document.getElementById('profile-total-deposit');
    const totalWdEl = document.getElementById('profile-total-withdraw');
    const txHistoryListEl = document.getElementById('profile-tx-history-list');

    // Update Profile Card
    if (nameEl) nameEl.textContent = displayName;
    if (usernameEl) usernameEl.textContent = username;
    if (uidEl) uidEl.textContent = uid;

    if (avatarEl) {
      if (photo) {
        avatarEl.innerHTML = `<img src="${photo}" alt="${displayName}" class="profile-avatar-img" onerror="this.onerror=null; this.src=''; this.parentElement.textContent='${displayName.charAt(0).toUpperCase()}';">`;
      } else {
        avatarEl.textContent = displayName.charAt(0).toUpperCase();
      }
    }

    // Wallet Status
    if (user.ton_wallet_address) {
      const shortAddr = `${user.ton_wallet_address.substring(0, 6)}...${user.ton_wallet_address.slice(-4)}`;
      if (walletAddrEl) walletAddrEl.textContent = `${shortAddr} (${user.ton_wallet_type || 'Tonkeeper'})`;
      if (walletToggleBtn) {
        walletToggleBtn.textContent = 'Disconnect';
        walletToggleBtn.classList.add('connected');
      }
    } else {
      if (walletAddrEl) walletAddrEl.textContent = 'Not Connected';
      if (walletToggleBtn) {
        walletToggleBtn.textContent = 'Connect';
        walletToggleBtn.classList.remove('connected');
      }
    }

    // Balances & Stats
    if (availBalEl) availBalEl.textContent = `${Number(user.gram_balance || 0).toFixed(2)} GRAM`;
    if (tonBalEl) tonBalEl.textContent = `${Number(user.ton_balance || 0).toFixed(2)} TON`;
    if (totalDepEl) totalDepEl.textContent = `${Number(user.deposit_balance !== undefined ? user.deposit_balance : (user.total_deposited || 0)).toFixed(2)} GRAM`;
    if (totalWdEl) totalWdEl.textContent = `${Number(user.total_withdrawn || 0).toFixed(2)} GRAM`;

    // History
    this.renderTransactionHistory(user.transactions_history || [], txHistoryListEl);
  }

  renderTransactionHistory(history, container) {
    if (!container) return;

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="empty-tx-msg">
          <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <p>No transaction history recorded yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = history.slice(0, 20).map(tx => {
      const timeStr = new Date(tx.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isPositive = tx.isPositive !== false && !String(tx.amount || '').startsWith('-');
      const colorClass = isPositive ? 'green' : 'red';
      const statusLower = (tx.status || 'completed').toLowerCase();

      let tonscanLinkHtml = '';
      if (tx.txHash) {
        const explorerUrl = `https://tonviewer.com/transaction/${encodeURIComponent(tx.txHash)}`;
        tonscanLinkHtml = `
          <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="tx-tonscan-badge" style="display:inline-flex; align-items:center; gap:3px; font-size:10px; color:#00d2ff; text-decoration:none; margin-top:3px; font-weight:700;">
            <span>TON Scan ↗</span>
          </a>
        `;
      }

      return `
        <div class="tx-item-card">
          <div class="tx-icon-socket ${isPositive ? 'green' : (statusLower === 'pending' ? 'orange' : 'orange')}">
            ${isPositive 
              ? '<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>'
              : '<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>'
            }
          </div>
          <div class="tx-info-mid">
            <span class="tx-title">${tx.title || 'Transaction'}</span>
            <span class="tx-time">${timeStr}</span>
            ${tonscanLinkHtml}
          </div>
          <div class="tx-amount-col">
            <span class="tx-amount ${colorClass}">${tx.amount}</span>
            <span class="tx-status-badge ${statusLower}">${tx.status || 'Success'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  openDepositModal() {
    const VAULT_ADDRESS = 'UQDFaBOdgZhLBZRSG28qImvn-Gn4kZ0D0HQVEHCtS9fFu7P0';
    let currentAmount = 10;

    const renderStep1 = (amt = currentAmount) => {
      currentAmount = amt;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(VAULT_ADDRESS)}&margin=4`;

      return `
        <div class="modal-sheet deposit-modal-sheet">
          <div class="modal-header">
            <div class="tk-modal-header-left">
              <div class="tk-logo-socket" style="background: #0098ea;">
                <img src="/assets/tonkeeper-logo.webp" alt="Tonkeeper" class="tk-socket-img">
              </div>
              <div>
                <h3 style="font-size: 16px; font-weight: 900; color: #ffffff; margin: 0;">Deposit GRAM</h3>
                <p style="font-size: 11px; color: #00d2ff; margin: 2px 0 0 0; font-weight: 700;">Direct Tonkeeper On-Chain Deposit</p>
              </div>
            </div>
            <button class="btn-close-modal" id="btn-close-deposit-modal">✕</button>
          </div>

          <!-- Step 1 Indicator -->
          <div class="deposit-step-indicator">
            <span class="deposit-step-pill active">1. Amount & QR</span>
            <span class="deposit-step-divider">→</span>
            <span class="deposit-step-pill">2. Submit Tx ID</span>
          </div>

          <!-- 1. Amount Input & Quick Selection -->
          <div class="deposit-section-card">
            <div class="tk-input-header">
              <label for="deposit-input-amt">Enter Deposit Amount (Min: 1 GRAM)</label>
              <span class="deposit-min-tag">Min: 1.00 GRAM</span>
            </div>
            <div class="deposit-amt-input-wrap">
              <input 
                type="number" 
                id="deposit-input-amt" 
                min="1" 
                step="1" 
                value="${currentAmount}" 
                class="deposit-number-input"
                placeholder="10"
              />
              <span class="deposit-unit-badge">GRAM</span>
            </div>

            <!-- Quick Amount Chips -->
            <div class="deposit-chips-row">
              <button type="button" class="deposit-chip-btn ${currentAmount === 1 ? 'selected' : ''}" data-amt="1">1 GRAM</button>
              <button type="button" class="deposit-chip-btn ${currentAmount === 5 ? 'selected' : ''}" data-amt="5">5 GRAM</button>
              <button type="button" class="deposit-chip-btn ${currentAmount === 10 ? 'selected' : ''}" data-amt="10">10 GRAM</button>
              <button type="button" class="deposit-chip-btn ${currentAmount === 50 ? 'selected' : ''}" data-amt="50">50 GRAM</button>
              <button type="button" class="deposit-chip-btn ${currentAmount === 100 ? 'selected' : ''}" data-amt="100">100 GRAM</button>
            </div>
          </div>

          <!-- 2. QR Code Display -->
          <div class="deposit-qr-container">
            <div class="deposit-qr-frame">
              <img src="${qrUrl}" alt="Tonkeeper Deposit QR" class="deposit-qr-image" onerror="this.style.display='none'">
            </div>
            <p class="deposit-qr-caption">Scan with Tonkeeper or Camera to Transfer</p>
          </div>

          <!-- 3. Official Deposit Address -->
          <div class="deposit-address-card">
            <div class="tk-input-header">
              <label>Official GRAM Deposit Vault Address</label>
            </div>
            <div class="deposit-address-box">
              <span class="deposit-address-text" id="deposit-vault-addr">${VAULT_ADDRESS}</span>
              <button type="button" class="btn-tk-paste deposit-copy-btn" id="btn-copy-deposit-addr">
                <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>

          <!-- Notice -->
          <div class="deposit-warning-notice">
            <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>Transfer exact amount from Tonkeeper. Minimum 1 GRAM. Next, submit your Transaction ID to credit funds.</span>
          </div>

          <!-- Continue Action -->
          <button class="btn-claim-reward-continue tk-btn-save" id="btn-deposit-proceed-tx" style="margin-top: 14px;">
            <span>I Have Paid > Enter Tx ID</span>
          </button>
        </div>
      `;
    };

    const renderStep2 = (amt) => {
      return `
        <div class="modal-sheet deposit-modal-sheet">
          <div class="modal-header">
            <div class="tk-modal-header-left">
              <button class="deposit-back-btn" id="btn-deposit-back-step1">
                <svg class="svg-icon" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </button>
              <div>
                <h3 style="font-size: 16px; font-weight: 900; color: #ffffff; margin: 0;">Submit Transaction ID</h3>
                <p style="font-size: 11px; color: #00d2ff; margin: 2px 0 0 0; font-weight: 700;">Step 2 of 2: Blockchain Verification</p>
              </div>
            </div>
            <button class="btn-close-modal" id="btn-close-deposit-modal">✕</button>
          </div>

          <!-- Step 2 Indicator -->
          <div class="deposit-step-indicator">
            <span class="deposit-step-pill">1. Amount & QR</span>
            <span class="deposit-step-divider">→</span>
            <span class="deposit-step-pill active">2. Submit Tx ID</span>
          </div>

          <!-- Deposit Confirmation Summary -->
          <div class="deposit-summary-box">
            <div class="summary-row">
              <span class="summary-label">Deposit Amount:</span>
              <span class="summary-val highlight">${Number(amt).toFixed(2)} GRAM</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Target Vault:</span>
              <span class="summary-val addr">${VAULT_ADDRESS.substring(0, 10)}...${VAULT_ADDRESS.slice(-6)}</span>
            </div>
          </div>

          <!-- Transaction ID Input -->
          <div class="deposit-section-card" style="margin-top: 14px;">
            <div class="tk-input-header">
              <label for="deposit-txhash-input">Tonkeeper Transaction ID / Hash</label>
              <button type="button" class="btn-tk-paste" id="btn-paste-txhash">
                <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Paste</span>
              </button>
            </div>
            <div class="tk-input-wrapper">
              <input 
                type="text" 
                id="deposit-txhash-input" 
                placeholder="e.g. 5f8a92...b819 or Tonkeeper Tx ID" 
                class="tk-address-input"
                spellcheck="false"
                autocomplete="off"
              />
            </div>
            <span class="tk-input-hint">Open Tonkeeper > Tap your Sent transaction > Copy Transaction Hash or ID</span>
          </div>

          <!-- Confirm Deposit Button -->
          <button class="btn-claim-reward-continue tk-btn-save" id="btn-submit-final-deposit" style="margin-top: 18px;">
            <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Verify On-Chain & Add ${Number(amt).toFixed(2)} GRAM</span>
          </button>
        </div>
      `;
    };

    const modal = document.getElementById('action-modal');
    if (!modal) return;

    const bindStep1Events = () => {
      // Close button
      document.getElementById('btn-close-deposit-modal')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });

      // Amount input change
      const amtInput = document.getElementById('deposit-input-amt');
      amtInput?.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (val >= 1) currentAmount = val;
      });

      // Quick chips
      document.querySelectorAll('.deposit-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = Number(btn.getAttribute('data-amt'));
          if (val >= 1) {
            currentAmount = val;
            modal.innerHTML = renderStep1(currentAmount);
            modal.classList.add('active');
            bindStep1Events();
          }
        });
      });

      // Copy Address
      document.getElementById('btn-copy-deposit-addr')?.addEventListener('click', () => {
        navigator.clipboard.writeText(VAULT_ADDRESS);
        this.app.showToast('Copied GRAM Deposit Address to clipboard!', 'success');
      });

      // Proceed to Step 2
      document.getElementById('btn-deposit-proceed-tx')?.addEventListener('click', () => {
        const amtVal = Number(document.getElementById('deposit-input-amt')?.value);
        if (isNaN(amtVal) || amtVal < 1) {
          this.app.showToast('Minimum deposit amount is 1 GRAM. Cannot deposit less.', 'error');
          return;
        }
        currentAmount = amtVal;
        modal.innerHTML = renderStep2(currentAmount);
        modal.classList.add('active');
        bindStep2Events();
      });
    };

    const bindStep2Events = () => {
      // Close button
      document.getElementById('btn-close-deposit-modal')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });

      // Back to Step 1
      document.getElementById('btn-deposit-back-step1')?.addEventListener('click', () => {
        modal.innerHTML = renderStep1(currentAmount);
        modal.classList.add('active');
        bindStep1Events();
      });

      // Paste Tx Hash
      document.getElementById('btn-paste-txhash')?.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          const input = document.getElementById('deposit-txhash-input');
          if (input && text) {
            input.value = text.trim();
            this.app.showToast('Transaction ID pasted', 'info');
          }
        } catch (err) {
          this.app.showToast('Please manually paste your Transaction ID', 'info');
        }
      });

      // Submit Final Deposit
      document.getElementById('btn-submit-final-deposit')?.addEventListener('click', async () => {
        const txInput = document.getElementById('deposit-txhash-input');
        const txHash = txInput?.value.trim();

        if (!txHash || txHash.length < 3) {
          this.app.showToast('Please enter your Tonkeeper Transaction ID / Hash', 'error');
          return;
        }

        modal.classList.remove('active');
        await this.executeDeposit(currentAmount, txHash);
      });
    };

    modal.innerHTML = renderStep1(currentAmount);
    modal.classList.add('active');
    bindStep1Events();
  }

  async executeDeposit(amountGram, txHash) {
    if (amountGram < 1) {
      this.app.showToast('Minimum deposit is 1 GRAM. Less than 1 GRAM is not permitted.', 'error');
      return;
    }

    this.app.showToast('Scanning TON Blockchain for Transaction...', 'info');

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          amountGram: amountGram,
          txHash: txHash
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        this.app.state.user = data.user;
        this.renderWallet();
        this.app.renderAllTabs();
        this.showDepositSuccessModal(data.amount || amountGram, txHash);
      } else {
        this.app.showToast(data.message || 'Deposit verification failed', 'error');
      }
    } catch (e) {
      console.error('Deposit execution error:', e);
      this.app.showToast('Network error while verifying deposit', 'error');
    }
  }

  showDepositSuccessModal(amount, txHash) {
    const modal = document.getElementById('action-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-sheet tonkeeper-connect-sheet" style="text-align: center;">
        <div style="width: 56px; height: 56px; margin: 0 auto 12px auto; background: rgba(0, 255, 136, 0.15); border: 2px solid #00ff88; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg class="svg-icon" style="width: 28px; height: 28px; stroke: #00ff88; stroke-width: 3;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 900; color: #ffffff; margin: 0;">Deposit Verified On-Chain!</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 14px 0;">Funds verified on TON Blockchain and added to your balance.</p>

        <div class="deposit-summary-box" style="margin-bottom: 16px;">
          <div class="summary-row">
            <span class="summary-label">Credited Amount:</span>
            <span class="summary-val highlight">+${Number(amount).toFixed(2)} GRAM</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Transaction ID:</span>
            <span class="summary-val addr" style="font-size: 11px;">${txHash.substring(0, 14)}...</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Blockchain Status:</span>
            <span class="summary-val" style="color: #00ff88; font-weight: 900;">Verified Confirmed</span>
          </div>
        </div>

        <button class="btn-claim-reward-continue" id="btn-close-dep-success">
          Done
        </button>
      </div>
    `;

    modal.classList.add('active');
    document.getElementById('btn-close-dep-success')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  openWithdrawModal() {
    const user = this.app.state.user;
    if (!user?.ton_wallet_address) {
      this.app.showToast('Please connect Tonkeeper wallet first before withdrawing', 'info');
      this.app.tonConnectManager.openWalletSelectionModal();
      return;
    }

    const availBal = Number(user.gram_balance || 0);
    const depBal = Number(user.deposit_balance || 0);
    let withdrawAmount = availBal >= 1 ? 1.00 : 1.00;

    const modal = document.getElementById('action-modal');
    if (!modal) return;

    const renderWithdrawView = (amt = withdrawAmount) => {
      withdrawAmount = amt;
      const shortAddr = `${user.ton_wallet_address.substring(0, 8)}...${user.ton_wallet_address.slice(-6)}`;

      return `
        <div class="modal-sheet withdraw-modal-sheet">
          <!-- Header -->
          <div class="modal-header">
            <div class="tk-modal-header-left">
              <div class="tk-logo-socket" style="background: linear-gradient(135deg, #0098ea 0%, #0070c9 100%);">
                <img src="/assets/tonkeeper-logo.webp" alt="Tonkeeper" class="tk-socket-img">
              </div>
              <div>
                <h3 style="font-size: 17px; font-weight: 900; color: #ffffff; margin: 0; letter-spacing: -0.02em;">Withdraw Funds</h3>
                <p style="font-size: 11.5px; color: #00d2ff; margin: 2px 0 0 0; font-weight: 700;">Instant On-Chain TON Payout</p>
              </div>
            </div>
            <button class="btn-close-modal" id="btn-close-withdraw-modal">✕</button>
          </div>

          <!-- Highlight Withdrawable Balance Card -->
          <div class="withdraw-balance-card">
            <div class="withdraw-balance-header">
              <span class="withdraw-balance-title">
                <svg class="svg-icon" style="width: 14px; height: 14px; stroke: #00ff88;" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                Available for Withdrawal
              </span>
              <span class="withdraw-badge-verified">
                <span class="withdraw-badge-dot"></span>
                Withdrawable
              </span>
            </div>
            <div class="withdraw-balance-val-row">
              <div class="withdraw-main-amt">
                ${availBal.toFixed(2)} <span class="unit">GRAM (TON)</span>
              </div>
              <div class="withdraw-locked-bal" title="Deposited funds are used exclusively for mining rig purchases">
                🔒 Rigs Only: ${depBal.toFixed(2)} GRAM
              </div>
            </div>
          </div>

          <!-- Connected Destination Wallet Card -->
          <div class="deposit-address-card" style="margin-bottom: 12px;">
            <div class="tk-input-header">
              <label style="color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                Payout Destination (${user.ton_wallet_type || 'Tonkeeper'})
              </label>
              <span class="deposit-min-tag" style="color: #00ff88; background: rgba(0,255,136,0.12); border: 1px solid rgba(0,255,136,0.3);">
                Verified Linked
              </span>
            </div>
            <div class="deposit-address-box">
              <span class="deposit-address-text" style="font-size: 12px; color: #38bdf8;">${shortAddr}</span>
              <button type="button" class="btn-tk-paste deposit-copy-btn" id="btn-copy-wd-addr">
                <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>

          <!-- Withdrawal Notice -->
          <div class="deposit-warning-notice" style="margin-bottom: 14px;">
            <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>Only claimed rewards in your <strong>Available Balance</strong> can be withdrawn. Minimum withdrawal is <strong>1.00 GRAM / TON</strong>.</span>
          </div>

          <!-- Amount Input Section -->
          <div class="deposit-section-card">
            <div class="tk-input-header">
              <label for="withdraw-input-amount" style="font-weight: 800; color: #e2e8f0;">Enter Withdrawal Amount</label>
              <span class="deposit-min-tag" style="color: #fbbf24; background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3);">
                Min: 1.00 GRAM
              </span>
            </div>
            <div class="deposit-amt-input-wrap">
              <input 
                type="number" 
                id="withdraw-input-amount" 
                min="1" 
                step="any" 
                value="${withdrawAmount}" 
                class="deposit-number-input"
                placeholder="1.00"
              />
              <span class="deposit-unit-badge">GRAM</span>
            </div>

            <!-- Quick Chips Selection -->
            <div class="deposit-chips-row">
              <button type="button" class="deposit-chip-btn ${withdrawAmount === 1 ? 'selected' : ''}" data-amt="1">1 GRAM</button>
              <button type="button" class="deposit-chip-btn ${withdrawAmount === 5 ? 'selected' : ''}" data-amt="5">5 GRAM</button>
              <button type="button" class="deposit-chip-btn ${withdrawAmount === 10 ? 'selected' : ''}" data-amt="10">10 GRAM</button>
              <button type="button" class="deposit-chip-btn ${withdrawAmount === 25 ? 'selected' : ''}" data-amt="25">25 GRAM</button>
              <button type="button" class="deposit-chip-btn ${withdrawAmount === Math.max(1, Number(availBal.toFixed(2))) ? 'selected' : ''}" data-amt="max">MAX</button>
            </div>
          </div>

          <!-- Mini Transaction Details -->
          <div class="withdraw-info-grid">
            <div class="withdraw-info-mini-card">
              <span class="withdraw-info-mini-title">Network Payout</span>
              <span class="withdraw-info-mini-val" style="color: #00d2ff;">TON Blockchain</span>
            </div>
            <div class="withdraw-info-mini-card">
              <span class="withdraw-info-mini-title">Processing Speed</span>
              <span class="withdraw-info-mini-val" style="color: #00ff88;">Instant (~5-15s)</span>
            </div>
          </div>

          <!-- Action Button -->
          <button class="btn-claim-reward-continue tk-btn-save" id="btn-confirm-final-withdraw" style="margin-top: 16px;">
            <svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            <span>Confirm On-Chain Withdrawal</span>
          </button>
        </div>
      `;
    };

    const bindWithdrawEvents = () => {
      // Close modal
      document.getElementById('btn-close-withdraw-modal')?.addEventListener('click', () => {
        modal.classList.remove('active');
      });

      // Copy Wallet Address
      document.getElementById('btn-copy-wd-addr')?.addEventListener('click', () => {
        navigator.clipboard.writeText(user.ton_wallet_address);
        this.app.showToast('Copied receiving wallet address', 'success');
      });

      // Amount Input change
      const amtInput = document.getElementById('withdraw-input-amount');
      amtInput?.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) withdrawAmount = val;
      });

      // Quick Chips
      document.querySelectorAll('.deposit-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const valAttr = btn.getAttribute('data-amt');
          if (valAttr === 'max') {
            withdrawAmount = Math.max(1, Number(availBal.toFixed(2)));
          } else {
            const val = Number(valAttr);
            if (val >= 1) withdrawAmount = val;
          }
          modal.innerHTML = renderWithdrawView(withdrawAmount);
          modal.classList.add('active');
          bindWithdrawEvents();
        });
      });

      // Confirm Withdrawal Action
      document.getElementById('btn-confirm-final-withdraw')?.addEventListener('click', () => {
        const input = document.getElementById('withdraw-input-amount');
        const amount = Number(input?.value || withdrawAmount);
        this.executeWithdraw(amount);
      });
    };

    modal.innerHTML = renderWithdrawView(withdrawAmount);
    modal.classList.add('active');
    bindWithdrawEvents();
  }

  async executeWithdraw(amount) {
    const user = this.app.state.user;
    const reqAmount = Number(amount);

    if (isNaN(reqAmount) || reqAmount < 1) {
      this.app.showToast('Minimum withdrawal amount is 1.00 GRAM', 'error');
      return;
    }

    const availBal = Number(user.gram_balance || 0);
    if (reqAmount > availBal) {
      this.app.showToast(`Insufficient Available Balance (${availBal.toFixed(2)} GRAM). Deposit balance cannot be withdrawn.`, 'error');
      return;
    }

    const modal = document.getElementById('action-modal');
    modal?.classList.remove('active');

    this.app.showToast('Processing On-Chain Withdrawal...', 'info');

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          amount: reqAmount
        })
      });
      const data = await res.json();

      if (data.success) {
        this.app.state.user = data.user;
        this.renderWallet();
        this.app.renderAllTabs();
        this.showWithdrawSuccessModal(reqAmount, user.ton_wallet_address);
      } else {
        this.app.showToast(data.message || 'Withdrawal failed', 'error');
      }
    } catch (e) {
      console.error('Withdraw error:', e);
      this.app.showToast('Connection error during withdrawal', 'error');
    }
  }

  showWithdrawSuccessModal(amount, destination) {
    const modal = document.getElementById('action-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-sheet tonkeeper-connect-sheet" style="text-align: center;">
        <div style="width: 56px; height: 56px; margin: 0 auto 12px auto; background: rgba(0, 240, 255, 0.15); border: 2px solid #00d2ff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg class="svg-icon" style="width: 28px; height: 28px; stroke: #00d2ff; stroke-width: 3;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 900; color: #ffffff; margin: 0;">Withdrawal Request Submitted!</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 14px 0;">Your payout request has been queued. Funds will be transferred to your destination wallet.</p>

        <div class="deposit-summary-box" style="margin-bottom: 16px;">
          <div class="summary-row">
            <span class="summary-label">Requested Payout:</span>
            <span class="summary-val highlight" style="color: #00d2ff;">${Number(amount).toFixed(2)} GRAM</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Destination Wallet:</span>
            <span class="summary-val addr" style="font-size: 11px;">${destination.substring(0, 10)}...${destination.slice(-6)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Payout Status:</span>
            <span class="summary-val" style="color: #f59e0b; font-weight: 900;">⏳ Pending Admin Payout</span>
          </div>
        </div>

        <button class="btn-claim-reward-continue" id="btn-close-wd-success">
          Done
        </button>
      </div>
    `;

    modal.classList.add('active');
    document.getElementById('btn-close-wd-success')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  async mockDeposit(tonAmount, gramAmount) {
    try {
      const res = await fetch('/api/deposit/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          amountGram: gramAmount
        })
      });

      const data = await res.json();
      if (data.success) {
        this.app.state.user = data.user;
        this.app.showToast(data.message, 'success');
        this.renderWallet();
        this.app.renderAllTabs();
        document.getElementById('action-modal')?.classList.remove('active');
      }
    } catch (e) {
      console.error('Deposit error:', e);
    }
  }
}


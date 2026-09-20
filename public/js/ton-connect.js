// ==========================================================================
// TONKEEPER WALLET ENGINE (ADDRESS INPUT, CLIPBOARD PASTE & CLOUD SYNC)
// ==========================================================================

export class TonConnectManager {
  constructor(app) {
    this.app = app;
    this.connectedWallet = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const connectBtn = document.getElementById('btn-header-wallet');
    const modal = document.getElementById('action-modal');

    // Top Header Connect Button Click
    connectBtn?.addEventListener('click', () => {
      this.openTonkeeperAddressModal();
    });
  }

  openWalletSelectionModal() {
    this.openTonkeeperAddressModal();
  }

  openTonkeeperAddressModal() {
    const modal = document.getElementById('action-modal');
    if (!modal) return;

    const user = this.app.state.user;
    const currentAddress = user?.ton_wallet_address || '';
    const isConnected = Boolean(currentAddress);

    modal.innerHTML = `
      <div class="modal-sheet tonkeeper-connect-sheet">
        <div class="modal-header">
          <div class="tk-modal-header-left">
            <div class="tk-logo-socket">
              <img src="/assets/tonkeeper-logo.webp" alt="Tonkeeper" class="tk-socket-img">
            </div>
            <div>
              <h3 style="font-size: 16px; font-weight: 900; color: #ffffff; margin: 0;">Tonkeeper Wallet</h3>
              <p style="font-size: 11px; color: #00d2ff; margin: 2px 0 0 0; font-weight: 700;">GRAM Cloud Mining Destination</p>
            </div>
          </div>
          <button class="btn-close-modal" id="btn-close-tk-modal">✕</button>
        </div>

        <div class="tk-bonus-callout">
          <div class="tk-bonus-icon">
            <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="tk-bonus-text">
            <span><strong>+200 GRAM Bonus</strong> rewarded upon wallet connection</span>
          </div>
        </div>

        <div class="tk-input-section">
          <div class="tk-input-header">
            <label for="tk-wallet-input">Tonkeeper / GRAM Address</label>
            <button type="button" class="btn-tk-paste" id="btn-tk-paste-clipboard">
              <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Paste</span>
            </button>
          </div>

          <div class="tk-input-wrapper">
            <input 
              type="text" 
              id="tk-wallet-input" 
              placeholder="e.g. UQBE0627...FC6C25 or EQ..." 
              value="${currentAddress}"
              class="tk-address-input"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <span class="tk-input-hint">Open Tonkeeper > Tap Receive > Copy & Paste your Address</span>
        </div>

        <div class="tk-actions-group">
          <button class="btn-claim-reward-continue tk-btn-save" id="btn-save-tk-wallet">
            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>${isConnected ? 'Update Wallet Address' : 'Save & Link Wallet'}</span>
          </button>

          ${isConnected ? `
            <button class="btn-disconnect-tk-wallet" id="btn-disconnect-tk-wallet">
              Disconnect Wallet
            </button>
          ` : ''}
        </div>
      </div>
    `;

    modal.classList.add('active');

    // Close button
    document.getElementById('btn-close-tk-modal')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    // Paste from clipboard
    document.getElementById('btn-tk-paste-clipboard')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const input = document.getElementById('tk-wallet-input');
        if (input && text) {
          input.value = text.trim();
          this.app.showToast('Address pasted from clipboard', 'info');
        }
      } catch (err) {
        this.app.showToast('Please type or manually paste your address', 'info');
      }
    });

    // Save wallet address
    document.getElementById('btn-save-tk-wallet')?.addEventListener('click', async () => {
      const input = document.getElementById('tk-wallet-input');
      const address = input?.value.trim();

      if (!address || address.length < 12) {
        this.app.showToast('Please enter a valid Tonkeeper address (min 12 chars)', 'error');
        return;
      }

      modal.classList.remove('active');
      await this.handleWalletConnected(address, 'Tonkeeper');
    });

    // Disconnect wallet
    document.getElementById('btn-disconnect-tk-wallet')?.addEventListener('click', async () => {
      modal.classList.remove('active');
      await this.handleWalletDisconnected();
    });
  }

  async handleWalletConnected(address, walletName = 'Tonkeeper') {
    this.connectedWallet = { address, walletName };

    try {
      const res = await fetch('/api/wallet/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          walletAddress: address,
          walletName: walletName
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.app.state.user = data.user;
        this.updateHeaderUI();
        this.app.renderAllTabs();
        this.app.showToast(data.message || 'Tonkeeper wallet linked successfully (+200 GRAM)!', 'success');
      } else {
        this.app.showToast(data.message || 'Failed to link wallet', 'error');
      }
    } catch (e) {
      console.error('Wallet bind error:', e);
      this.app.showToast('Connection error during wallet binding', 'error');
    }
  }

  async handleWalletDisconnected() {
    this.connectedWallet = null;
    try {
      const res = await fetch('/api/wallet/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.app.state.userId })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.app.state.user = data.user;
        this.updateHeaderUI();
        this.app.renderAllTabs();
        this.app.showToast('Wallet disconnected', 'info');
      }
    } catch (e) {
      console.error('Wallet disconnect error:', e);
    }
  }

  disconnectWallet() {
    this.handleWalletDisconnected();
  }

  updateHeaderUI() {
    const btn = document.getElementById('btn-header-wallet');
    const label = document.getElementById('wallet-btn-label');
    const user = this.app.state.user;

    if (user?.ton_wallet_address) {
      btn?.classList.add('connected');
      const addr = user.ton_wallet_address;
      const shortAddr = addr.length > 12 ? `${addr.substring(0, 4)}...${addr.slice(-4)}` : addr;
      if (label) label.textContent = shortAddr;
    } else {
      btn?.classList.remove('connected');
      if (label) label.textContent = 'Connect Wallet';
    }
  }
}

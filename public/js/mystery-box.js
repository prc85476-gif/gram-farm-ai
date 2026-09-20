export class MysteryBoxManager {
  constructor(app) {
    this.app = app;
    this.isOpening = false;
    this.boxVariations = [
      { name: 'Crystal Gift Box', img: '/assets/box-ton.jpg', color: '#00d2ff' },
      { name: 'Cyber Tech Crate', img: '/assets/box-gram.jpg', color: '#a855f7' },
      { name: 'Gold Treasure Chest', img: '/assets/box-gold.jpg', color: '#fbbf24' }
    ];

    this.initElements();
  }

  initElements() {
    this.container = document.getElementById('mystery-box-section');
    this.countBadge = document.getElementById('available-boxes-count');
    this.gridContainer = document.getElementById('gift-boxes-interactive-grid');
    this.historyList = document.getElementById('mystery-box-history-list');
    this.unboxingModal = document.getElementById('unboxing-modal');
  }

  renderMysteryBoxUI() {
    const user = this.app.state.user;
    if (!user) return;

    const availableCount = user.mystery_boxes_available !== undefined ? user.mystery_boxes_available : 0;

    if (this.countBadge) {
      this.countBadge.textContent = `${availableCount} Available`;
    }

    this.renderInteractiveBoxes(availableCount);
    this.renderHistory(user.opened_boxes_history || []);
  }

  renderInteractiveBoxes(availableCount) {
    if (!this.gridContainer) return;

    if (availableCount <= 0) {
      // Clean locked state with 1 preview box and invite button
      this.gridContainer.innerHTML = `
        <div class="empty-box-locked-card" onclick="window.app.copyReferralLink()">
          <div class="locked-box-visual">
            <img src="/assets/box-gram.jpg" alt="Gift Box" class="locked-box-img">
            <div class="lock-overlay-badge">
              <svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
          </div>
          <div class="locked-box-info">
            <h4>No Unopened Gift Boxes</h4>
            <p>Invite friends to get +1 Gift Box for every partner!</p>
            <button class="btn-unlock-invite" onclick="event.stopPropagation(); window.app.shareTelegramReferral();">
              <svg class="svg-icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              <span>Invite Friend to Get Box</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Render interactive clickable boxes for each available box
    let boxesHtml = `<div class="interactive-boxes-row">`;
    for (let i = 0; i < availableCount; i++) {
      const boxStyle = this.boxVariations[i % this.boxVariations.length];
      boxesHtml += `
        <div class="clickable-gift-box-card" data-box-index="${i}" onclick="window.app.mysteryBoxManager.handleOpenBox(${i})">
          <div class="box-tap-pulse-ring"></div>
          <div class="box-image-holder">
            <img src="${boxStyle.img}" alt="${boxStyle.name}" class="interactive-box-img">
            <div class="tap-to-open-tag">TAP TO OPEN</div>
          </div>
          <div class="box-card-details">
            <span class="box-title">${boxStyle.name}</span>
            <span class="box-reward-hint">Win 0.01 – 0.05 GRAM</span>
          </div>
        </div>
      `;
    }
    boxesHtml += `</div>`;

    this.gridContainer.innerHTML = boxesHtml;
  }

  renderHistory(history) {
    if (!this.historyList) return;

    if (!history || history.length === 0) {
      this.historyList.innerHTML = `
        <div class="empty-loot-msg">
          <p>No boxes opened yet. Refer a friend to get your first Gift Box!</p>
        </div>
      `;
      return;
    }

    this.historyList.innerHTML = history.slice(0, 8).map(item => {
      const timeStr = new Date(item.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const gramVal = Number(item.rewardGram || 0).toFixed(4);
      return `
        <div class="loot-history-item">
          <div class="loot-item-img-box">
            <img src="${item.boxImg || '/assets/box-ton.jpg'}" alt="${item.boxName || 'Gift Box'}">
          </div>
          <div class="loot-item-details">
            <div class="loot-item-name">${item.boxName || 'Gift Box'}</div>
            <div class="loot-item-time">${timeStr}</div>
          </div>
          <div class="loot-item-reward">
            <div class="reward-gram">+${gramVal} GRAM</div>
          </div>
        </div>
      `;
    }).join('');
  }

  async handleOpenBox(boxIndex = 0) {
    const user = this.app.state.user;
    if (!user) return;

    const availableCount = user.mystery_boxes_available !== undefined ? user.mystery_boxes_available : 0;
    if (availableCount <= 0) {
      this.app.copyReferralLink();
      this.app.showToast('Refer a friend to earn +1 Gift Box!', 'info');
      return;
    }

    if (this.isOpening) return;
    this.isOpening = true;

    // Pick box variation for animation
    const selectedBox = this.boxVariations[boxIndex % this.boxVariations.length];
    this.showUnboxingModal(selectedBox);

    try {
      const res = await fetch('/api/mystery-box/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.app.state.userId })
      });
      const data = await res.json();

      if (data.success) {
        setTimeout(() => {
          this.revealReward(data);
        }, 1500);
      } else {
        this.closeUnboxingModal();
        this.app.showToast(data.message || 'Failed to open box', 'error');
        this.isOpening = false;
      }
    } catch (e) {
      console.error('Error opening box:', e);
      this.closeUnboxingModal();
      this.app.showToast('Network error, please try again', 'error');
      this.isOpening = false;
    }
  }

  showUnboxingModal(box) {
    if (!this.unboxingModal) return;

    const boxImg = box?.img || '/assets/box-gram.jpg';

    this.unboxingModal.innerHTML = `
      <div class="unboxing-card">
        <div class="wood-rivet tl"></div>
        <div class="wood-rivet tr"></div>
        <div class="wood-rivet bl"></div>
        <div class="wood-rivet br"></div>

        <div class="unboxing-anim-container">
          <div class="unboxing-rays"></div>
          <div class="unboxing-box-wrapper shaking">
            <img src="${boxImg}" alt="Opening Gift Box" class="unboxing-box-img">
          </div>
        </div>

        <h3 class="unboxing-title">OPENING GIFT BOX...</h3>
        <p class="unboxing-subtitle">Synthesizing instant GRAM reward</p>
      </div>
    `;

    this.unboxingModal.classList.add('active');
  }

  revealReward(data) {
    if (!this.unboxingModal) return;

    if (data.user) {
      this.app.state.user = data.user;
      this.app.renderAllTabs();
    }

    const box = data.box || this.boxVariations[0];
    const gramVal = Number(data.rewardGram || 0).toFixed(4);

    this.unboxingModal.innerHTML = `
      <div class="unboxing-card reveal">
        <div class="wood-rivet tl"></div>
        <div class="wood-rivet tr"></div>
        <div class="wood-rivet bl"></div>
        <div class="wood-rivet br"></div>

        <div class="unboxing-anim-container revealed">
          <div class="unboxing-burst-glow"></div>
          <div class="unboxing-box-wrapper floated">
            <img src="${box.img}" alt="${box.name}" class="unboxing-box-img">
          </div>
        </div>

        <div class="reward-congrats-badge">CONGRATULATIONS!</div>
        <h3 class="reward-title">${box.name}</h3>

        <div class="reward-single-container">
          <div class="reward-pill-card gram-card-single">
            <div class="reward-pill-icon">
              <img src="/assets/gram-logo.svg" alt="GRAM">
            </div>
            <div class="reward-pill-info">
              <span class="lbl">GRAM REWARD WON</span>
              <span class="val">+${gramVal} GRAM</span>
            </div>
          </div>
        </div>

        <p class="reward-balance-note">Deposited directly into your GRAM balance!</p>

        <button class="btn-claim-reward-continue" id="btn-close-reward-modal">
          <svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span>Claim & Continue</span>
        </button>
      </div>
    `;

    document.getElementById('btn-close-reward-modal')?.addEventListener('click', () => {
      this.closeUnboxingModal();
    });
  }

  closeUnboxingModal() {
    if (this.unboxingModal) {
      this.unboxingModal.classList.remove('active');
    }
    this.isOpening = false;
    this.renderMysteryBoxUI();
  }
}

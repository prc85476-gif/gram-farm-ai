// ==========================================================================
// TASKS & EARN ENGINE (WOOD RPG THEME WITH LIVE COUNTDOWN TIMERS & VERIFICATION)
// ==========================================================================

export class TasksManager {
  constructor(app) {
    this.app = app;
    this.tasks = [];
    this.taskStates = {}; // Stores client UI state e.g. { join_tg_channel: 'verify' }
    this.countdownInterval = null;
    this.init();
  }

  async init() {
    await this.fetchTasks();
    this.startCountdownLoop();
    this.setupGiftCodeForm();
  }

  async fetchTasks() {
    try {
      const res = await fetch(`/api/tasks/${this.app.state.userId}`);
      const data = await res.json();
      if (data.success) {
        this.tasks = data.tasks;
        if (data.user) {
          this.app.state.user = data.user;
        }
        this.renderTasks();
      }
    } catch (e) {
      console.error('Fetch tasks error:', e);
    }
  }

  startCountdownLoop() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      this.updateDailyTimers();
    }, 1000);
  }

  formatTimeRemaining(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  updateDailyTimers() {
    const now = Date.now();
    let needsReRender = false;

    this.tasks.forEach(task => {
      if (task.category === 'daily') {
        const timerBtn = document.getElementById(`btn-task-${task.id}`);
        const timerSub = document.getElementById(`timer-sub-${task.id}`);

        if (task.completed && task.nextAvailableAt) {
          const diff = task.nextAvailableAt - now;

          if (diff > 0) {
            const timeFormatted = this.formatTimeRemaining(diff);
            if (timerBtn) {
              timerBtn.textContent = `⏳ ${timeFormatted}`;
              timerBtn.className = 'btn-task-action timer-cooldown completed';
              timerBtn.disabled = true;
            }
            if (timerSub) {
              timerSub.textContent = `Next bonus in: ${timeFormatted}`;
            }
          } else {
            // Timer expired, task is ready to claim again!
            task.completed = false;
            task.nextAvailableAt = null;
            needsReRender = true;
          }
        }
      }
    });

    if (needsReRender) {
      this.renderTasks();
    }
  }

  renderTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    const now = Date.now();

    container.innerHTML = this.tasks.map(task => {
      const isDone = task.completed;
      const isTon = task.rewardCurrency === 'TON' || task.rewardTon > 0;
      const rewardText = isTon 
        ? `+${Number(task.rewardTon || task.rewardAmount || 1).toFixed(2)} TON`
        : `+${Number(task.rewardGram || task.rewardAmount || 0.01).toFixed(2)} GRAM`;

      let btnText = 'Claim';
      let btnClass = '';
      let isDisabled = false;
      let timerSubtitle = '';

      if (task.category === 'daily') {
        if (isDone && task.nextAvailableAt && task.nextAvailableAt > now) {
          const diff = task.nextAvailableAt - now;
          const timeFormatted = this.formatTimeRemaining(diff);
          btnText = `⏳ ${timeFormatted}`;
          btnClass = 'timer-cooldown completed';
          isDisabled = true;
          timerSubtitle = `<span class="task-timer-badge" id="timer-sub-${task.id}">Next bonus in: ${timeFormatted}</span>`;
        } else {
          btnText = 'Claim';
          btnClass = 'claim-ready';
        }
      } else if (isDone) {
        btnText = 'Claimed';
        btnClass = 'completed';
        isDisabled = true;
      } else if (task.id === 'join_tg_channel') {
        const state = this.taskStates['join_tg_channel'];
        if (state === 'verify') {
          btnText = 'Verify';
          btnClass = 'verify';
        } else if (state === 'checking') {
          btnText = 'Checking...';
          btnClass = 'verify';
          isDisabled = true;
        } else {
          btnText = 'Join';
        }
      } else if (task.requiredInvites) {
        const refCount = this.app.state.user?.referrals_count || 0;
        const target = task.requiredInvites;
        if (refCount < target) {
          btnText = `Invite (${refCount}/${target})`;
          btnClass = '';
        } else {
          btnText = `Claim ${rewardText}`;
          btnClass = 'claim-ready';
        }
      }

      return `
        <div class="wood-plank task-item">
          <div class="wood-rivet tl"></div>
          <div class="wood-rivet tr"></div>
          <div class="wood-rivet bl"></div>
          <div class="wood-rivet br"></div>

          <div class="task-left">
            <div class="wood-oct-socket ${isTon ? 'blue' : 'gold'}">
              ${this.getTaskSvgIcon(task.icon)}
            </div>
            <div class="task-info">
              <h4>${task.title}</h4>
              <div class="task-reward-row">
                <span class="task-reward ${isTon ? 'ton-reward' : ''}">${rewardText}</span>
                ${timerSubtitle}
              </div>
            </div>
          </div>

          <button 
            id="btn-task-${task.id}"
            class="btn-task-action ${btnClass}"
            onclick="window.app.tasksManager.handleTaskClick('${task.id}', '${task.link || ''}')"
            ${isDisabled ? 'disabled' : ''}
          >
            ${btnText}
          </button>
        </div>
      `;
    }).join('');
  }

  getTaskSvgIcon(iconName) {
    switch (iconName) {
      case 'calendar':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
      case 'wallet':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>`;
      case 'telegram':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
      case 'users':
        return `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
      default:
        return `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>`;
    }
  }

  async handleTaskClick(taskId, link) {
    const task = this.tasks.find(t => t.id === taskId);

    // 1. Join Telegram Channel Task flow (Strict Bot API Verification)
    if (taskId === 'join_tg_channel') {
      const currentState = this.taskStates['join_tg_channel'];

      // First click: open Telegram link and prompt user to verify after joining
      if (currentState !== 'verify') {
        if (link) {
          window.open(link, '_blank');
        }
        this.taskStates['join_tg_channel'] = 'verify';
        this.renderTasks();
        this.app.showToast('Please join @GramfarmAimining channel and then tap Verify!', 'info');
        return;
      }

      // Second click: Verify membership via getChatMember
      this.taskStates['join_tg_channel'] = 'checking';
      this.renderTasks();
      this.app.showToast('Checking Telegram channel membership...', 'info');

      try {
        const res = await fetch('/api/tasks/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.app.state.userId,
            taskId: taskId
          })
        });

        const data = await res.json();
        if (data.success) {
          this.app.state.user = data.user;
          this.taskStates['join_tg_channel'] = 'claimed';
          this.app.showToast(data.message || 'Verified! +0.10 GRAM added to balance.', 'success');
          await this.fetchTasks();
          this.app.renderAllTabs();
        } else {
          this.taskStates['join_tg_channel'] = 'verify';
          this.renderTasks();
          this.app.showToast(data.message || 'Please join @GramfarmAimining first!', 'error');
        }
      } catch (e) {
        console.error('Task claim error:', e);
        this.taskStates['join_tg_channel'] = 'verify';
        this.renderTasks();
        this.app.showToast('Connection error verifying task', 'error');
      }
      return;
    }

    // 2. Invite Referral Milestone tasks flow (e.g. 3 friends, 100 friends)
    if (task && task.requiredInvites) {
      const refCount = this.app.state.user?.referrals_count || 0;
      const target = task.requiredInvites;
      if (refCount < target) {
        const isTon = task.rewardCurrency === 'TON' || task.rewardTon > 0;
        const reward = isTon ? `${task.rewardTon || 1.00} TON` : `${task.rewardGram || 0.20} GRAM`;
        this.app.showToast(`Invite ${target} friends to unlock ${reward}! (Current: ${refCount}/${target})`, 'info');
        this.app.switchTab('friends');
        return;
      }
    }

    // 3. Daily Claim and other tasks
    try {
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          taskId: taskId
        })
      });

      const data = await res.json();
      if (data.success) {
        this.app.state.user = data.user;
        this.app.showToast(data.message, 'success');
        await this.fetchTasks();
        this.app.renderAllTabs();
      } else {
        this.app.showToast(data.message, 'error');
      }
    } catch (e) {
      console.error('Task claim error:', e);
      this.app.showToast('Network error while completing task', 'error');
    }
  }

  // =========================================================================
  // GIFT CODE / SECRET PROMO BOX CLAIM HANDLERS
  // =========================================================================

  setupGiftCodeForm() {
    const pasteBtn = document.getElementById('btn-paste-gift-code');
    const submitBtn = document.getElementById('btn-submit-gift-code');
    const inputEl = document.getElementById('input-gift-code');

    pasteBtn?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputEl.value = text.trim();
          this.app.showToast('Pasted Gift Code from clipboard!', 'info');
        }
      } catch (e) {
        this.app.showToast('Please paste your code directly into the input', 'info');
      }
    });

    submitBtn?.addEventListener('click', () => {
      this.handleClaimGiftCode();
    });

    inputEl?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleClaimGiftCode();
      }
    });
  }

  async handleClaimGiftCode() {
    const inputEl = document.getElementById('input-gift-code');
    const code = (inputEl?.value || '').trim();
    if (!code) {
      this.app.showToast('Please enter or paste a Gift Code', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-gift-code');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Claiming...';
    }

    try {
      const res = await fetch('/api/gift-code/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.app.state.userId,
          code: code
        })
      });

      const data = await res.json();
      if (data.success) {
        this.app.state.user = data.user;
        if (inputEl) inputEl.value = '';
        this.app.showToast(data.message || `🎉 Successfully claimed +${data.rewardGram} GRAM!`, 'success');
        this.app.renderAllTabs();
      } else {
        this.app.showToast(data.message || 'Failed to claim Gift Code', 'error');
      }
    } catch (e) {
      console.error('Claim gift code error:', e);
      this.app.showToast('Network error claiming Gift Code', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Claim Gift';
      }
    }
  }
}

// ==========================================================================
// HIGH-TECH ANIMATED CYBER GRID & CONSTELLATION ENGINE
// Smooth animated tech nodes, glowing data packets & cyber connections
// ==========================================================================

export class TechBackground {
  constructor(canvasId = 'tech-cyber-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.nodes = [];
    this.packets = [];
    this.nodeCount = 22;
    this.maxDist = 70;
    this.animId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.createNodes();
    this.animate();
  }

  resize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = rect.width || 360;
    this.height = this.canvas.height = rect.height || 260;
  }

  createNodes() {
    this.nodes = [];
    for (let i = 0; i < this.nodeCount; i++) {
      this.nodes.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.8 + 1.2,
        color: i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#0084f0' : '#00d2ff',
        pulse: Math.random() * Math.PI,
        pulseSpeed: 0.03 + Math.random() * 0.03
      });
    }

    // Occasional data packet running on connections
    setInterval(() => {
      if (this.nodes.length < 2) return;
      const i1 = Math.floor(Math.random() * this.nodes.length);
      let closest = -1;
      let minD = this.maxDist;
      for (let j = 0; j < this.nodes.length; j++) {
        if (i1 === j) continue;
        const dx = this.nodes[i1].x - this.nodes[j].x;
        const dy = this.nodes[i1].y - this.nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) {
          minD = d;
          closest = j;
        }
      }
      if (closest !== -1) {
        this.packets.push({
          from: this.nodes[i1],
          to: this.nodes[closest],
          progress: 0,
          speed: 0.04,
          color: '#0084f0'
        });
      }
    }, 450);
  }

  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Update and draw nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += n.pulseSpeed;

      // Bounce off walls
      if (n.x < 0 || n.x > this.width) n.vx *= -1;
      if (n.y < 0 || n.y > this.height) n.vy *= -1;

      const currentRadius = n.radius + Math.sin(n.pulse) * 0.6;

      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, Math.max(0.8, currentRadius), 0, Math.PI * 2);
      this.ctx.fillStyle = n.color;
      this.ctx.globalAlpha = 0.55 + Math.sin(n.pulse) * 0.25;
      this.ctx.fill();

      // Subtle outer glow halo
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, currentRadius * 2.2, 0, Math.PI * 2);
      this.ctx.fillStyle = n.color;
      this.ctx.globalAlpha = 0.12;
      this.ctx.fill();
    }

    // 2. Draw connecting circuit lines
    this.ctx.lineWidth = 0.9;
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.maxDist) {
          const alpha = (1 - dist / this.maxDist) * 0.22;
          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          this.ctx.strokeStyle = '#00d2ff';
          this.ctx.globalAlpha = alpha * 1.3;
          this.ctx.stroke();
        }
      }
    }

    // 3. Draw travelling data packets
    for (let p = this.packets.length - 1; p >= 0; p--) {
      const pkt = this.packets[p];
      pkt.progress += pkt.speed;

      if (pkt.progress >= 1) {
        this.packets.splice(p, 1);
        continue;
      }

      const curX = pkt.from.x + (pkt.to.x - pkt.from.x) * pkt.progress;
      const curY = pkt.from.y + (pkt.to.y - pkt.from.y) * pkt.progress;

      this.ctx.beginPath();
      this.ctx.arc(curX, curY, 2.2, 0, Math.PI * 2);
      this.ctx.fillStyle = '#00d2ff';
      this.ctx.globalAlpha = 0.9;
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1.0;
    this.animId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
  }
}

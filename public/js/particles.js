// Particle & Confetti Canvas Engine
class ParticleEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.particles = [];
    this.animId = null;

    if (this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(x, y, color = '#FFD600', count = 30) {
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color,
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02,
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 10
      });
    }
    this.startLoop();
  }

  victoryConfetti(durationMs = 4000) {
    if (!this.ctx) return;
    const colors = ['#FF3366', '#00E676', '#FFD600', '#00D2FF', '#FFFFFF', '#E040FB'];
    const startTime = Date.now();

    const spawnInterval = setInterval(() => {
      if (Date.now() - startTime > durationMs) {
        clearInterval(spawnInterval);
        return;
      }
      for (let i = 0; i < 15; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: -20,
          vx: (Math.random() - 0.5) * 4,
          vy: 3 + Math.random() * 5,
          size: 6 + Math.random() * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.004 + Math.random() * 0.004,
          rotation: Math.random() * 360,
          spin: (Math.random() - 0.5) * 8
        });
      }
      this.startLoop();
    }, 100);
  }

  startLoop() {
    if (this.animId) return;
    const loop = () => {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.alpha -= p.decay;
        p.rotation += p.spin;

        if (p.alpha <= 0 || p.y > this.canvas.height + 50) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        this.ctx.restore();
      }

      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(loop);
      } else {
        this.animId = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    };
    this.animId = requestAnimationFrame(loop);
  }
}

window.ParticleEngine = ParticleEngine;

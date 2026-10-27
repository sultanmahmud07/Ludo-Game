// Glassmorphic UI Controller for Ludo Board, Tokens, and Animations
class LudoUI {
  constructor(boardContainer, onTokenClick) {
    this.board = boardContainer;
    this.onTokenClick = onTokenClick;
    this.tokenElements = {}; // { 'red_0': el, ... }
    this.isAnimating = false;
    this.currentOrientationColor = 'red';
  }

  // Rotate the board so the local player's house is always in the Bottom-Left
  setBoardOrientation(myColor) {
    const targetColor = myColor || 'red';
    this.currentOrientationColor = targetColor;
    const angles = {
      blue: 0,
      red: -90,
      green: 180,
      yellow: 90
    };
    const angle = angles[targetColor] !== undefined ? angles[targetColor] : -90;
    this.board.style.transform = `rotate(${angle}deg)`;
    this.board.style.setProperty('--board-counter-rot', `${-angle}deg`);
  }

  // Generate the 15x15 Glassmorphic Ludo Board Grid
  initBoard() {
    this.board.innerHTML = '';

    // Create the 15x15 grid cells
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Classify cells
        this.decorateCell(cell, r, c);
        this.board.appendChild(cell);
      }
    }

    // Add Central Center Triangle Graphic Layer
    this.createCenterTriangles();

    // Add Yard bases (visual frosted inner circles with pedestals)
    this.createYardDecorations();

    // Layer for tokens container
    const tokensLayer = document.createElement('div');
    tokensLayer.id = 'tokens-layer';
    tokensLayer.className = 'tokens-layer';
    this.board.appendChild(tokensLayer);

    // Create all 16 token DOM elements
    const colors = ['red', 'green', 'yellow', 'blue'];
    colors.forEach(color => {
      for (let i = 0; i < 4; i++) {
        const key = `${color}_${i}`;
        const token = document.createElement('div');
        token.className = `ludo-token token-${color}`;
        token.id = `token-${key}`;
        token.dataset.color = color;
        token.dataset.index = i;
        token.innerHTML = `
          <div class="token-glow"></div>
          <div class="token-inner">
            <span class="token-pip">${i + 1}</span>
          </div>
        `;

        token.addEventListener('click', (e) => {
          e.stopPropagation();
          if (token.classList.contains('movable')) {
            if (this.onTokenClick) {
              this.onTokenClick(color, i);
            }
          }
        });

        tokensLayer.appendChild(token);
        this.tokenElements[key] = token;
      }
    });
  }

  decorateCell(cell, r, c) {
    // Yards: (0..5, 0..5), (0..5, 9..14), (9..14, 0..5), (9..14, 9..14)
    if (r < 6 && c < 6) {
      cell.classList.add('yard-cell', 'yard-red');
      return;
    }
    if (r < 6 && c >= 9) {
      cell.classList.add('yard-cell', 'yard-green');
      return;
    }
    if (r >= 9 && c >= 9) {
      cell.classList.add('yard-cell', 'yard-yellow');
      return;
    }
    if (r >= 9 && c < 6) {
      cell.classList.add('yard-cell', 'yard-blue');
      return;
    }

    // Center 3x3: (6..8, 6..8)
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
      cell.classList.add('center-cell');
      return;
    }

    // Track path cells
    cell.classList.add('track-cell');

    // Home Corridors
    if (r === 7 && c >= 1 && c <= 5) {
      cell.classList.add('home-stretch', 'stretch-red');
      return;
    }
    if (c === 7 && r >= 1 && r <= 5) {
      cell.classList.add('home-stretch', 'stretch-green');
      return;
    }
    if (r === 7 && c >= 9 && c <= 13) {
      cell.classList.add('home-stretch', 'stretch-yellow');
      return;
    }
    if (c === 7 && r >= 9 && r <= 13) {
      cell.classList.add('home-stretch', 'stretch-blue');
      return;
    }

    // Start Cells
    if (r === 6 && c === 1) {
      cell.classList.add('start-cell', 'start-red');
      cell.innerHTML = '<span class="cell-star">★</span>';
      return;
    }
    if (r === 1 && c === 8) {
      cell.classList.add('start-cell', 'start-green');
      cell.innerHTML = '<span class="cell-star">★</span>';
      return;
    }
    if (r === 8 && c === 13) {
      cell.classList.add('start-cell', 'start-yellow');
      cell.innerHTML = '<span class="cell-star">★</span>';
      return;
    }
    if (r === 13 && c === 6) {
      cell.classList.add('start-cell', 'start-blue');
      cell.innerHTML = '<span class="cell-star">★</span>';
      return;
    }

    // Additional Star Safe Cells
    const safeStars = [
      [2, 6], [6, 12], [12, 8], [8, 2]
    ];
    for (const [sr, sc] of safeStars) {
      if (r === sr && c === sc) {
        cell.classList.add('safe-cell');
        cell.innerHTML = '<span class="cell-star">★</span>';
        return;
      }
    }
  }

  createCenterTriangles() {
    const centerWrap = document.createElement('div');
    centerWrap.className = 'board-center-triangle-wrap';
    centerWrap.innerHTML = `
      <div class="center-tri tri-red"></div>
      <div class="center-tri tri-green"></div>
      <div class="center-tri tri-yellow"></div>
      <div class="center-tri tri-blue"></div>
      <div class="center-gold-badge">🏆</div>
    `;
    this.board.appendChild(centerWrap);
  }

  createYardDecorations() {
    const yardPositions = [
      { color: 'red', style: 'top: 0; left: 0;' },
      { color: 'green', style: 'top: 0; right: 0;' },
      { color: 'yellow', style: 'bottom: 0; right: 0;' },
      { color: 'blue', style: 'bottom: 0; left: 0;' }
    ];

    yardPositions.forEach(y => {
      const yard = document.createElement('div');
      yard.className = `yard-overlay yard-overlay-${y.color}`;
      yard.style.cssText = y.style;
      yard.innerHTML = `
        <div class="yard-box">
          <div class="yard-inner-card">
            <div class="yard-slot-ring ring-0"></div>
            <div class="yard-slot-ring ring-1"></div>
            <div class="yard-slot-ring ring-2"></div>
            <div class="yard-slot-ring ring-3"></div>
          </div>
        </div>
      `;
      this.board.appendChild(yard);
    });
  }

  // Dim or activate board sections based on active player colors
  updateActiveSections(activeColors) {
    const allColors = ['red', 'green', 'yellow', 'blue'];
    allColors.forEach(color => {
      const isActive = !activeColors || activeColors.length === 0 || activeColors.includes(color);
      const yardOverlay = this.board.querySelector(`.yard-overlay-${color}`);
      if (yardOverlay) {
        yardOverlay.classList.toggle('section-dimmed', !isActive);
      }
      this.board.querySelectorAll(`.stretch-${color}, .start-${color}, .yard-${color}`).forEach(el => {
        el.classList.toggle('section-dimmed', !isActive);
      });
      const tri = this.board.querySelector(`.tri-${color}`);
      if (tri) {
        tri.classList.toggle('section-dimmed', !isActive);
      }
    });
  }

  // Update token positions with collision grouping
  renderTokens(tokensState) {
    const activeColors = Object.keys(tokensState || {});
    const allColors = ['red', 'green', 'yellow', 'blue'];

    // 1. Hide tokens for any colors that are NOT active in this game
    allColors.forEach(color => {
      const isActive = activeColors.includes(color);
      for (let i = 0; i < 4; i++) {
        const key = `${color}_${i}`;
        const el = this.tokenElements[key];
        if (el) {
          el.style.display = isActive ? 'block' : 'none';
        }
      }
    });

    // 2. Dim inactive yard sections on the board
    this.updateActiveSections(activeColors);

    // 3. Position the active tokens
    const cellGroups = {};

    for (const [color, steps] of Object.entries(tokensState || {})) {
      steps.forEach((step, idx) => {
        const key = `${color}_${idx}`;
        const coords = BoardData.getTokenCoordinates(color, idx, step);
        const cellKey = `${coords[0].toFixed(1)}_${coords[1].toFixed(1)}`;

        if (!cellGroups[cellKey]) cellGroups[cellKey] = [];
        cellGroups[cellKey].push({ key, color, idx, step, coords });
      });
    }

    // Apply positions with dynamic clustering if multiple tokens are on same cell
    Object.values(cellGroups).forEach(group => {
      const count = group.length;

      group.forEach((item, i) => {
        const el = this.tokenElements[item.key];
        if (!el) return;

        let [r, c] = item.coords;
        let scale = 1;

        if (count > 1 && item.step !== -1 && item.step !== 56) {
          // Token clustering offset
          const angle = (i * 2 * Math.PI) / count;
          const radius = 0.22; // cell fraction
          r += Math.sin(angle) * radius;
          c += Math.cos(angle) * radius;
          scale = count > 2 ? 0.78 : 0.86;
        }

        const pctLeft = ((c + 0.5) / 15) * 100;
        const pctTop = ((r + 0.5) / 15) * 100;

        el.style.left = `${pctLeft}%`;
        el.style.top = `${pctTop}%`;
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      });
    });
  }

  // Animate a single token step-by-step
  async animateTokenMovement(color, tokenIdx, fromStep, toStep, onComplete) {
    this.isAnimating = true;
    const key = `${color}_${tokenIdx}`;
    const el = this.tokenElements[key];

    if (!el) {
      this.isAnimating = false;
      if (onComplete) onComplete();
      return;
    }

    // Clear movable highlights
    this.clearMovableHighlights();

    // From yard to start
    if (fromStep === -1) {
      if (window.soundCtrl) window.soundCtrl.playTokenStep(0);
      const targetCoords = BoardData.getTokenCoordinates(color, tokenIdx, 0);
      const left = ((targetCoords[1] + 0.5) / 15) * 100;
      const top = ((targetCoords[0] + 0.5) / 15) * 100;

      el.classList.add('token-hop');
      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      el.style.transform = `translate(-50%, -50%) scale(1.15)`;

      await this.sleep(220);
      el.classList.remove('token-hop');
      el.style.transform = `translate(-50%, -50%) scale(1)`;

      this.isAnimating = false;
      if (onComplete) onComplete();
      return;
    }

    // Hop cell by cell
    for (let s = fromStep + 1; s <= toStep; s++) {
      if (window.soundCtrl) window.soundCtrl.playTokenStep(s);

      const coords = BoardData.getTokenCoordinates(color, tokenIdx, s);
      const left = ((coords[1] + 0.5) / 15) * 100;
      const top = ((coords[0] + 0.5) / 15) * 100;

      el.classList.add('token-hop');
      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      el.style.transform = `translate(-50%, -50%) scale(1.2)`;

      await this.sleep(140);
      el.classList.remove('token-hop');
      el.style.transform = `translate(-50%, -50%) scale(1)`;
      await this.sleep(40);
    }

    this.isAnimating = false;
    if (onComplete) onComplete();
  }

  highlightMovableTokens(color, validTokens) {
    this.clearMovableHighlights();
    if (!validTokens || validTokens.length === 0) return;

    validTokens.forEach(idx => {
      const key = `${color}_${idx}`;
      const el = this.tokenElements[key];
      if (el) {
        el.classList.add('movable');
      }
    });
  }

  clearMovableHighlights() {
    Object.values(this.tokenElements).forEach(el => {
      el.classList.remove('movable');
    });
  }

  showTurnMessage(text, type = 'info') {
    const banner = document.getElementById('turn-status-banner');
    if (!banner) return;

    banner.textContent = text;
    banner.className = `turn-status-banner status-${type}`;
    banner.style.animation = 'none';
    banner.offsetHeight; // trigger reflow
    banner.style.animation = 'pulseStatus 0.4s ease-out';
  }

  updatePlayerCards(players, activeColor, tokensState, winners = []) {
    players.forEach(p => {
      const card = document.getElementById(`player-card-${p.color}`);
      if (!card) return;

      const isActive = (p.color === activeColor);
      card.classList.toggle('active-turn', isActive);

      // Tokens at home count
      const homeCount = tokensState && tokensState[p.color]
        ? tokensState[p.color].filter(s => s === 56).length
        : 0;

      const badge = card.querySelector('.tokens-home-badge');
      if (badge) {
        if (winners.includes(p.color)) {
          const rank = winners.indexOf(p.color) + 1;
          const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd', '4th'];
          badge.textContent = medals[rank - 1] || 'Finished';
          badge.className = 'tokens-home-badge winner';
        } else {
          badge.textContent = `${homeCount}/4 Home`;
          badge.className = 'tokens-home-badge';
        }
      }

      // Name & bot icon
      const nameEl = card.querySelector('.player-name');
      if (nameEl) {
        nameEl.textContent = p.name;
      }
    });
  }

  sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
}

window.LudoUI = LudoUI;

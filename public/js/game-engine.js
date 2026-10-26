// Client-side Ludo Game Engine (Offline & Pass-and-Play & AI)
class LudoGameEngine {
  constructor() {
    this.players = []; // [{ color, name, isBot, avatar }]
    this.activePlayerIndex = 0;
    this.tokens = {}; // { red: [-1,-1,-1,-1], ... }
    this.diceValue = null;
    this.hasRolled = false;
    this.consecutiveSixes = 0;
    this.validTokens = [];
    this.winners = [];
    this.isGameOver = false;

    // Callbacks
    this.onDiceRolled = null;
    this.onTokenMoved = null;
    this.onTurnChanged = null;
    this.onPlayerWon = null;
    this.onGameOver = null;
  }

  init(playersConfig) {
    // Standard turn sequence: red -> green -> yellow -> blue
    const standardOrder = ['red', 'green', 'yellow', 'blue'];
    this.players = playersConfig
      .filter(p => p.active)
      .sort((a, b) => standardOrder.indexOf(a.color) - standardOrder.indexOf(b.color));

    this.tokens = {};
    this.players.forEach(p => {
      this.tokens[p.color] = [-1, -1, -1, -1];
    });

    this.activePlayerIndex = 0;
    this.diceValue = null;
    this.hasRolled = false;
    this.consecutiveSixes = 0;
    this.validTokens = [];
    this.winners = [];
    this.isGameOver = false;

    if (this.onTurnChanged) {
      this.onTurnChanged(this.getActivePlayer());
    }
  }

  getActivePlayer() {
    return this.players[this.activePlayerIndex];
  }

  rollDice() {
    if (this.isGameOver || this.hasRolled) return null;

    const roll = Math.floor(Math.random() * 6) + 1;
    this.diceValue = roll;
    this.hasRolled = true;

    if (roll === 6) {
      this.consecutiveSixes++;
    } else {
      this.consecutiveSixes = 0;
    }

    const activeColor = this.getActivePlayer().color;

    // 3rd consecutive 6 penalty: turn is lost!
    if (this.consecutiveSixes >= 3) {
      if (this.onDiceRolled) {
        this.onDiceRolled(roll, activeColor, [], true);
      }
      setTimeout(() => {
        this.nextTurn();
      }, 1200);
      return { roll, penalty: true, validTokens: [] };
    }

    const validMoves = this.getValidMoves(activeColor, roll);
    this.validTokens = validMoves;

    if (this.onDiceRolled) {
      this.onDiceRolled(roll, activeColor, validMoves, false);
    }

    // Auto-advance if no valid moves
    if (validMoves.length === 0) {
      setTimeout(() => {
        this.nextTurn();
      }, 1200);
    }

    return { roll, penalty: false, validTokens: validMoves };
  }

  getValidMoves(color, roll) {
    const playerTokens = this.tokens[color];
    const valid = [];

    playerTokens.forEach((step, tokenIdx) => {
      if (step === -1) {
        if (roll === 6) valid.push(tokenIdx);
      } else if (step >= 0 && step < 56) {
        if (step + roll <= 56) {
          valid.push(tokenIdx);
        }
      }
    });

    return valid;
  }

  moveToken(tokenIdx) {
    if (this.isGameOver || !this.hasRolled) return null;
    if (!this.validTokens.includes(tokenIdx)) return null;

    const activePlayer = this.getActivePlayer();
    const color = activePlayer.color;
    const roll = this.diceValue;
    const currentStep = this.tokens[color][tokenIdx];
    let newStep = currentStep === -1 ? 0 : currentStep + roll;

    this.tokens[color][tokenIdx] = newStep;

    // Check for captures
    let captured = null;
    if (newStep >= 0 && newStep <= 50) {
      const globalIndex = (BoardData.COLOR_START_INDEX[color] + newStep) % 52;
      const isSafe = BoardData.isSafeCell(globalIndex);

      if (!isSafe) {
        for (const [otherColor, otherTokens] of Object.entries(this.tokens)) {
          if (otherColor === color) continue;
          otherTokens.forEach((otherStep, otherIdx) => {
            if (otherStep >= 0 && otherStep <= 50) {
              const otherGlobalIndex = (BoardData.COLOR_START_INDEX[otherColor] + otherStep) % 52;
              if (otherGlobalIndex === globalIndex) {
                // Opponent captured! Reset to yard
                this.tokens[otherColor][otherIdx] = -1;
                captured = { color: otherColor, tokenIdx: otherIdx };
              }
            }
          });
        }
      }
    }

    const reachedHome = (newStep === 56);

    // Check if player won
    const allHome = this.tokens[color].every(s => s === 56);
    let playerWon = false;
    if (allHome && !this.winners.includes(color)) {
      this.winners.push(color);
      playerWon = true;
      if (this.onPlayerWon) {
        this.onPlayerWon(color, this.winners.length);
      }
    }

    const extraRoll = (roll === 6 || captured !== null || reachedHome);

    const result = {
      color,
      tokenIdx,
      oldStep: currentStep,
      newStep,
      captured,
      reachedHome,
      playerWon,
      extraRoll
    };

    if (this.onTokenMoved) {
      this.onTokenMoved(result);
    }

    // Check if game is over
    const totalPlayers = this.players.length;
    if (this.winners.length >= totalPlayers - 1) {
      this.isGameOver = true;
      // Add the remaining player as last place
      const lastPlayer = this.players.find(p => !this.winners.includes(p.color));
      if (lastPlayer && !this.winners.includes(lastPlayer.color)) {
        this.winners.push(lastPlayer.color);
      }
      if (this.onGameOver) {
        this.onGameOver(this.winners);
      }
      return result;
    }

    // Handle next step or bonus turn
    if (extraRoll) {
      this.hasRolled = false;
      this.diceValue = null;
      this.validTokens = [];
      if (this.onTurnChanged) {
        this.onTurnChanged(this.getActivePlayer(), true);
      }
    } else {
      this.nextTurn();
    }

    return result;
  }

  nextTurn() {
    this.hasRolled = false;
    this.diceValue = null;
    this.validTokens = [];
    this.consecutiveSixes = 0;

    const total = this.players.length;
    let attempts = 0;
    do {
      this.activePlayerIndex = (this.activePlayerIndex + 1) % total;
      const nextPlayer = this.players[this.activePlayerIndex];
      if (!this.winners.includes(nextPlayer.color)) {
        break;
      }
      attempts++;
    } while (attempts < total);

    if (this.onTurnChanged) {
      this.onTurnChanged(this.getActivePlayer(), false);
    }
  }
}

window.LudoGameEngine = LudoGameEngine;

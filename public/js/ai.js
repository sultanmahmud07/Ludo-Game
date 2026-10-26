// Smart AI Bot Heuristics Engine
class LudoAI {
  static evaluateMove(engine, color, tokenIdx, roll) {
    const tokens = engine.tokens[color];
    const currentStep = tokens[tokenIdx];
    let score = 0;

    // 1. Move into Home Goal (56)
    if (currentStep + roll === 56) {
      return 1000;
    }

    // 2. Move out of Yard on 6
    if (currentStep === -1) {
      if (roll === 6) {
        // High priority to bring pieces into play, especially if no tokens on board
        const tokensOnBoard = tokens.filter(s => s >= 0 && s < 56).length;
        score += (tokensOnBoard === 0) ? 300 : 180;
      }
      return score;
    }

    const nextStep = currentStep + roll;

    // 3. Capture opponent
    if (nextStep <= 50) {
      const targetGlobal = (BoardData.COLOR_START_INDEX[color] + nextStep) % 52;
      const isTargetSafe = BoardData.isSafeCell(targetGlobal);

      if (!isTargetSafe) {
        for (const [otherColor, otherTokens] of Object.entries(engine.tokens)) {
          if (otherColor === color) continue;
          otherTokens.forEach(oppStep => {
            if (oppStep >= 0 && oppStep <= 50) {
              const oppGlobal = (BoardData.COLOR_START_INDEX[otherColor] + oppStep) % 52;
              if (oppGlobal === targetGlobal) {
                // Massive capture incentive
                score += 400;
              }
            }
          });
        }
      } else {
        // Landing on safe star
        score += 85;
      }

      // Check if current position was dangerous
      const currentGlobal = (BoardData.COLOR_START_INDEX[color] + currentStep) % 52;
      if (!BoardData.isSafeCell(currentGlobal)) {
        // Check if an enemy is behind us within 6 steps
        for (const [otherColor, otherTokens] of Object.entries(engine.tokens)) {
          if (otherColor === color) continue;
          otherTokens.forEach(oppStep => {
            if (oppStep >= 0 && oppStep <= 50) {
              const oppGlobal = (BoardData.COLOR_START_INDEX[otherColor] + oppStep) % 52;
              const dist = (currentGlobal - oppGlobal + 52) % 52;
              if (dist >= 1 && dist <= 6) {
                // We were in danger! Moving away is smart
                score += 120;
              }
            }
          });
        }
      }
    } else if (nextStep > 50) {
      // Entering home stretch (safe sanctuary)
      score += 150;
    }

    // Progress incentive: advance tokens closer to home
    score += currentStep * 3;

    // Slight random factor to prevent mechanical repetition
    score += Math.random() * 10;

    return score;
  }

  static selectBestMove(engine, color, validTokens, roll) {
    if (!validTokens || validTokens.length === 0) return null;
    if (validTokens.length === 1) return validTokens[0];

    let bestScore = -Infinity;
    let bestToken = validTokens[0];

    for (const tokenIdx of validTokens) {
      const score = this.evaluateMove(engine, color, tokenIdx, roll);
      if (score > bestScore) {
        bestScore = score;
        bestToken = tokenIdx;
      }
    }

    return bestToken;
  }
}

window.LudoAI = LudoAI;

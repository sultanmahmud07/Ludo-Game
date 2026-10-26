// Master Application Controller (Mobile-First View Router & Multiplayer Room Engine)
document.addEventListener('DOMContentLoaded', () => {
  // Screens
  const screenMenu = document.getElementById('screen-main-menu');
  const screenPortal = document.getElementById('screen-room-portal');
  const screenLobby = document.getElementById('screen-online-lobby');
  const screenArena = document.getElementById('screen-game-arena');
  const allScreens = [screenMenu, screenPortal, screenLobby, screenArena];

  // Drawers & Modals
  const drawerGameMenu = document.getElementById('drawer-game-menu');
  const drawerChat = document.getElementById('drawer-chat');
  const modalPassSetup = document.getElementById('modal-offline-setup');
  const modalRules = document.getElementById('modal-rules');
  const modalVictory = document.getElementById('modal-victory');
  const chatUnreadDot = document.getElementById('chat-unread-dot');

  // Interactive Elements
  const boardEl = document.getElementById('ludo-board');
  const diceCubeEl = document.getElementById('dice-cube');
  const rollBtn = document.getElementById('btn-roll-dice');
  const canvasEl = document.getElementById('fx-canvas');

  // Sound & FX
  const sound = window.soundCtrl;
  const particles = new ParticleEngine(canvasEl);

  // Engines
  let dice = null;
  let ui = null;
  let engine = new LudoGameEngine();
  let network = new NetworkClient();

  // State
  let currentScreen = 'menu';
  let gameMode = 'ai'; // 'offline' | 'ai' | 'online'
  let myOnlineColor = null;
  let currentRoomId = null;
  let isProcessingMove = false;
  let myPlayerName = localStorage.getItem('loodo_player_name') || 'Ludo Master';
  let myAvatar = localStorage.getItem('loodo_player_avatar') || '👑';

  // ==========================================
  // PROFILE & AVATAR SELECTION
  // ==========================================
  const homeNameInput = document.getElementById('input-home-name');
  const currentAvatarDisplay = document.getElementById('current-user-avatar');
  const avatarButtons = document.querySelectorAll('.btn-avatar-opt');

  homeNameInput.value = myPlayerName;
  currentAvatarDisplay.textContent = myAvatar;

  avatarButtons.forEach(btn => {
    if (btn.dataset.avatar === myAvatar) btn.classList.add('selected');
    else btn.classList.remove('selected');

    btn.addEventListener('click', () => {
      avatarButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      myAvatar = btn.dataset.avatar;
      currentAvatarDisplay.textContent = myAvatar;
      localStorage.setItem('loodo_player_avatar', myAvatar);
    });
  });

  homeNameInput.addEventListener('input', () => {
    myPlayerName = homeNameInput.value.trim() || 'Player';
    localStorage.setItem('loodo_player_name', myPlayerName);
  });

  // ==========================================
  // SCREEN ROUTER
  // ==========================================
  function switchScreen(screenName) {
    allScreens.forEach(s => s.classList.remove('screen-active'));
    currentScreen = screenName;

    if (screenName === 'menu') {
      screenMenu.classList.add('screen-active');
    } else if (screenName === 'portal') {
      screenPortal.classList.add('screen-active');
    } else if (screenName === 'lobby') {
      screenLobby.classList.add('screen-active');
    } else if (screenName === 'arena') {
      screenArena.classList.add('screen-active');
    }
  }

  // ==========================================
  // SOUND CONTROLS
  // ==========================================
  function updateSoundIcons() {
    const isMuted = sound.isMuted();
    const icon = isMuted ? '🔇' : '🔊';
    document.querySelectorAll('#btn-menu-sound, #btn-arena-sound').forEach(btn => {
      btn.innerHTML = icon;
    });
  }
  updateSoundIcons();

  document.querySelectorAll('#btn-menu-sound, #btn-arena-sound, #btn-drawer-sound').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.toggleMute();
      updateSoundIcons();
    });
  });

  // ==========================================
  // INITIALIZE BOARD & 3D DICE
  // ==========================================
  ui = new LudoUI(boardEl, (color, tokenIdx) => {
    handleTokenClick(color, tokenIdx);
  });
  ui.initBoard();

  dice = new DiceController(diceCubeEl, (value) => {
    // Dice completed roll
  });
  dice.setValueInstant(1);

  // ==========================================
  // DICE ROLL & MOVE TRIGGERS
  // ==========================================
  rollBtn.addEventListener('click', () => {
    triggerDiceRoll();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && currentScreen === 'arena') {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      triggerDiceRoll();
    }
  });

  function triggerDiceRoll() {
    if (isProcessingMove || dice.isRolling || currentScreen !== 'arena') return;

    if (gameMode === 'online') {
      const activeColor = network.activeColor;
      if (myOnlineColor !== activeColor) return;
      rollBtn.disabled = true;
      network.rollDice();
    } else {
      const activePlayer = engine.getActivePlayer();
      if (!activePlayer || activePlayer.isBot || engine.hasRolled) return;
      rollBtn.disabled = true;
      engine.rollDice();
    }
  }

  function handleTokenClick(color, tokenIdx) {
    if (isProcessingMove || currentScreen !== 'arena') return;

    if (gameMode === 'online') {
      if (color !== myOnlineColor) return;
      isProcessingMove = true;
      network.moveToken(tokenIdx);
    } else {
      const activePlayer = engine.getActivePlayer();
      if (!activePlayer || activePlayer.color !== color || activePlayer.isBot) return;
      isProcessingMove = true;
      engine.moveToken(tokenIdx);
    }
  }

  // ==========================================
  // OFFLINE & AI GAME ENGINE HOOKS
  // ==========================================
  engine.onDiceRolled = (roll, activeColor, validTokens, consecutivePenalty) => {
    dice.setDiceColor(activeColor);
    dice.roll(roll, () => {
      rollBtn.disabled = true;

      if (consecutivePenalty) {
        if (sound) sound.playPenalty();
        ui.showTurnMessage(`${capitalize(activeColor)} rolled three 6s! Turn skipped.`, 'warning');
        return;
      }

      if (validTokens.length === 0) {
        ui.showTurnMessage(`${capitalize(activeColor)} rolled a ${roll}. No valid moves!`, 'info');
      } else {
        ui.showTurnMessage(`${capitalize(activeColor)} rolled a ${roll}! Tap a token.`, 'success');
        ui.highlightMovableTokens(activeColor, validTokens);

        const activePlayer = engine.getActivePlayer();
        if (activePlayer.isBot) {
          setTimeout(() => {
            const bestToken = LudoAI.selectBestMove(engine, activeColor, validTokens, roll);
            if (bestToken !== null) {
              isProcessingMove = true;
              engine.moveToken(bestToken);
            }
          }, 700);
        }
      }
    });
  };

  engine.onTokenMoved = async (res) => {
    const { color, tokenIdx, oldStep, newStep, captured, reachedHome } = res;

    await ui.animateTokenMovement(color, tokenIdx, oldStep, newStep);
    ui.renderTokens(engine.tokens);

    if (captured) {
      if (sound) sound.playCapture();
      const bRect = boardEl.getBoundingClientRect();
      particles.burst(bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, '#FF3366', 35);
      ui.showTurnMessage(`💥 ${capitalize(color)} captured ${capitalize(captured.color)}'s token! Bonus Roll!`, 'warning');
    } else if (reachedHome) {
      if (sound) sound.playHomeEnter();
      const bRect = boardEl.getBoundingClientRect();
      particles.burst(bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, '#FFD600', 40);
      ui.showTurnMessage(`⭐ ${capitalize(color)} token reached Home! Bonus Roll!`, 'success');
    } else if (BoardData.isSafeCell((BoardData.COLOR_START_INDEX[color] + newStep) % 52)) {
      if (sound) sound.playSafeSpot();
    }

    updateArenaPlayerWidgets(engine.players, engine.getActivePlayer().color, engine.tokens, engine.winners);
    isProcessingMove = false;
  };

  engine.onTurnChanged = (activePlayer, isExtraRoll = false) => {
    isProcessingMove = false;
    ui.clearMovableHighlights();
    dice.setDiceColor(activePlayer.color);
    updateArenaPlayerWidgets(engine.players, activePlayer.color, engine.tokens, engine.winners);

    const isBot = activePlayer.isBot;
    rollBtn.disabled = isBot;

    if (isExtraRoll) {
      ui.showTurnMessage(`🎉 ${capitalize(activePlayer.color)} gets an Extra Roll!`, 'success');
    } else {
      ui.showTurnMessage(`${capitalize(activePlayer.color)}'s Turn (${activePlayer.name}) - Roll!`, 'info');
    }

    if (isBot && !engine.isGameOver) {
      setTimeout(() => {
        if (engine.getActivePlayer().isBot && !engine.hasRolled && !engine.isGameOver) {
          engine.rollDice();
        }
      }, 750);
    }
  };

  engine.onPlayerWon = (color, rank) => {
    if (sound) sound.playVictory();
    const bRect = boardEl.getBoundingClientRect();
    particles.burst(bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, '#FFD600', 50);
    ui.showTurnMessage(`🏆 ${capitalize(color)} finished in rank #${rank}!`, 'success');
  };

  engine.onGameOver = (winners) => {
    if (sound) sound.playVictory();
    particles.victoryConfetti(5000);
    showVictoryModal(winners, engine.players);
  };

  // ==========================================
  // ONLINE MULTIPLAYER SOCKET HOOKS
  // ==========================================
  network.onRoomUpdated = (data) => {
    renderLobbySlots(data.players, data.hostSocketId);
  };

  network.onGameStarted = (data) => {
    closeAllModalsAndDrawers();
    gameMode = 'online';
    network.activeColor = data.gameState.activeColor;

    // Show room code chip in arena top bar
    const roomChip = document.getElementById('arena-room-chip');
    const roomText = document.getElementById('arena-room-code-text');
    if (roomChip && currentRoomId) {
      roomChip.style.display = 'inline-flex';
      roomText.textContent = currentRoomId;
    }

    // Switch to Arena Screen
    switchScreen('arena');

    setupOnlinePlayerWidgets(data.players);
    ui.renderTokens(data.gameState.tokens);
    updateArenaPlayerWidgets(data.players, data.gameState.activeColor, data.gameState.tokens);

    const isMyTurn = (data.gameState.activeColor === myOnlineColor);
    rollBtn.disabled = !isMyTurn;
    dice.setDiceColor(data.gameState.activeColor);

    ui.showTurnMessage(
      isMyTurn ? "It's YOUR turn! Tap Dice to Roll!" : `${capitalize(data.gameState.activeColor)}'s turn to roll`,
      isMyTurn ? 'success' : 'info'
    );
  };

  network.onDiceRolled = (data) => {
    const { roll, activeColor, validTokens, consecutiveSixesPenalty } = data;
    network.activeColor = activeColor;
    dice.setDiceColor(activeColor);

    dice.roll(roll, () => {
      rollBtn.disabled = true;

      if (consecutiveSixesPenalty) {
        if (sound) sound.playPenalty();
        ui.showTurnMessage(`${capitalize(activeColor)} rolled three 6s! Turn forfeited.`, 'warning');
        return;
      }

      if (!validTokens || validTokens.length === 0) {
        ui.showTurnMessage(`${capitalize(activeColor)} rolled ${roll}. No valid moves!`, 'info');
      } else {
        const isMyTurn = (activeColor === myOnlineColor);
        if (isMyTurn) {
          ui.showTurnMessage(`You rolled ${roll}! Tap a glowing token.`, 'success');
          ui.highlightMovableTokens(activeColor, validTokens);
        } else {
          ui.showTurnMessage(`${capitalize(activeColor)} rolled ${roll}. Moving...`, 'info');
        }
      }
    });
  };

  network.onTokenMoved = async (data) => {
    const { moveResult, gameState } = data;
    const { color, tokenIdx, oldStep, newStep, captured, reachedHome } = moveResult;

    await ui.animateTokenMovement(color, tokenIdx, oldStep, newStep);
    ui.renderTokens(gameState.tokens);

    if (captured) {
      if (sound) sound.playCapture();
      const bRect = boardEl.getBoundingClientRect();
      particles.burst(bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, '#FF3366', 35);
      ui.showTurnMessage(`💥 ${capitalize(color)} captured ${capitalize(captured.color)}!`, 'warning');
    } else if (reachedHome) {
      if (sound) sound.playHomeEnter();
      const bRect = boardEl.getBoundingClientRect();
      particles.burst(bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, '#FFD600', 40);
      ui.showTurnMessage(`⭐ ${capitalize(color)} reached Home!`, 'success');
    }

    updateArenaPlayerWidgets(gameState.players || [], gameState.activeColor, gameState.tokens, gameState.winners);
    isProcessingMove = false;
  };

  network.onTurnChanged = (data) => {
    isProcessingMove = false;
    ui.clearMovableHighlights();
    const activeColor = data.gameState.activeColor;
    network.activeColor = activeColor;
    dice.setDiceColor(activeColor);

    const isMyTurn = (activeColor === myOnlineColor);
    rollBtn.disabled = !isMyTurn;

    ui.showTurnMessage(
      isMyTurn ? "It's YOUR turn! Tap Dice to Roll!" : `${capitalize(activeColor)}'s turn to roll`,
      isMyTurn ? 'success' : 'info'
    );
  };

  network.onExtraRoll = (data) => {
    isProcessingMove = false;
    ui.clearMovableHighlights();
    const isMyTurn = (data.activeColor === myOnlineColor);
    rollBtn.disabled = !isMyTurn;
    ui.showTurnMessage(
      isMyTurn ? "Bonus Roll! Tap Dice to Roll again!" : `${capitalize(data.activeColor)} gets a bonus roll!`,
      'success'
    );
  };

  network.onGameEnded = (data) => {
    if (sound) sound.playVictory();
    particles.victoryConfetti(5000);
    showVictoryModal(data.winners);
  };

  network.onNewChat = (msg) => {
    appendChatMessage(msg);
    if (msg.emoji) {
      showFloatingEmoji(msg.emoji, msg.senderColor);
    }
    // Show unread indicator if drawer is closed
    if (!drawerChat.classList.contains('active')) {
      chatUnreadDot.style.display = 'block';
    }
  };

  // ==========================================
  // ARENA PLAYER WIDGET UPDATER
  // ==========================================
  function updateArenaPlayerWidgets(players, activeColor, tokensState, winners = []) {
    players.forEach(p => {
      const card = document.getElementById(`player-card-${p.color}`);
      if (!card) return;

      const isActive = (p.color === activeColor);
      card.classList.toggle('active-turn', isActive);

      const homeCount = tokensState && tokensState[p.color]
        ? tokensState[p.color].filter(s => s === 56).length
        : 0;

      const badge = card.querySelector('.tokens-home-badge');
      if (badge) {
        if (winners.includes(p.color)) {
          const rank = winners.indexOf(p.color) + 1;
          const medals = ['🥇 1st', '🥈 2nd', '🥉 3rd', '4th'];
          badge.textContent = medals[rank - 1] || 'Win';
        } else {
          badge.textContent = `${homeCount}/4`;
        }
      }
    });
  }

  function setupOnlinePlayerWidgets(players) {
    const allColors = ['red', 'green', 'yellow', 'blue'];
    allColors.forEach(c => {
      const card = document.getElementById(`player-card-${c}`);
      if (card) card.style.display = 'none';
    });

    players.forEach(p => {
      const card = document.getElementById(`player-card-${p.color}`);
      if (card) {
        card.style.display = 'flex';
        const nameEl = card.querySelector('.player-name');
        if (nameEl) nameEl.textContent = p.name + (p.socketId === network.socket.id ? ' (You)' : '');
        const avatarEl = card.querySelector('.player-avatar');
        if (avatarEl) avatarEl.textContent = p.avatar || '👤';
      }
    });
  }

  function startOfflineGame(playersConfig) {
    closeAllModalsAndDrawers();
    gameMode = playersConfig.some(p => p.isBot) ? 'ai' : 'offline';

    // Hide room chip in offline mode
    const roomChip = document.getElementById('arena-room-chip');
    if (roomChip) roomChip.style.display = 'none';

    // Show active player widgets
    const allColors = ['red', 'green', 'yellow', 'blue'];
    allColors.forEach(c => {
      const card = document.getElementById(`player-card-${c}`);
      if (card) card.style.display = 'none';
    });

    playersConfig.forEach(p => {
      const card = document.getElementById(`player-card-${p.color}`);
      if (card) {
        card.style.display = p.active ? 'flex' : 'none';
        const nameEl = card.querySelector('.player-name');
        if (nameEl) nameEl.textContent = p.name;
        const avatarEl = card.querySelector('.player-avatar');
        if (avatarEl) avatarEl.textContent = p.avatar || (p.isBot ? '🤖' : '👤');
      }
    });

    switchScreen('arena');
    engine.init(playersConfig);
    ui.renderTokens(engine.tokens);
    updateArenaPlayerWidgets(engine.players, engine.getActivePlayer().color, engine.tokens);
  }

  // ==========================================
  // NAVIGATION & MENU CLICKS
  // ==========================================
  // Home buttons
  document.getElementById('btn-menu-online').addEventListener('click', () => {
    switchScreen('portal');
  });

  document.getElementById('btn-menu-ai').addEventListener('click', () => {
    const config = [
      { color: 'red', name: myPlayerName, isBot: false, active: true, avatar: myAvatar },
      { color: 'green', name: 'CyberBot', isBot: true, active: true, avatar: '🤖' },
      { color: 'yellow', name: 'NexusAI', isBot: true, active: true, avatar: '👾' },
      { color: 'blue', name: 'VortexAI', isBot: true, active: true, avatar: '⚡' }
    ];
    startOfflineGame(config);
  });

  document.getElementById('btn-menu-pass').addEventListener('click', () => {
    openModal(modalPassSetup);
  });

  document.getElementById('btn-menu-rules').addEventListener('click', () => {
    openModal(modalRules);
  });

  // Portal Back button
  document.getElementById('btn-back-from-portal').addEventListener('click', () => {
    switchScreen('menu');
  });

  // Portal tab switching (Create vs Join)
  const tabBtnCreate = document.getElementById('tab-btn-create');
  const tabBtnJoin = document.getElementById('tab-btn-join');
  const tabContentCreate = document.getElementById('tab-content-create');
  const tabContentJoin = document.getElementById('tab-content-join');

  function setPortalTab(tabName) {
    if (tabName === 'create') {
      tabBtnCreate.classList.add('active');
      tabBtnJoin.classList.remove('active');
      tabContentCreate.classList.add('active');
      tabContentJoin.classList.remove('active');
    } else {
      tabBtnJoin.classList.add('active');
      tabBtnCreate.classList.remove('active');
      tabContentJoin.classList.add('active');
      tabContentCreate.classList.remove('active');
    }
  }

  tabBtnCreate.addEventListener('click', () => setPortalTab('create'));
  tabBtnJoin.addEventListener('click', () => setPortalTab('join'));

  // ==========================================
  // ROOM CREATION & SHARING
  // ==========================================
  document.getElementById('btn-action-create-room').addEventListener('click', () => {
    const chosenColor = document.querySelector('input[name="create-color"]:checked')?.value || 'red';

    network.createRoom(myPlayerName, chosenColor, myAvatar, (res) => {
      if (res && res.success) {
        currentRoomId = res.roomId;
        myOnlineColor = chosenColor;
        showLobbyScreen(res.roomId, res.players, true);
      } else {
        alert(res?.error || 'Failed to create room');
      }
    });
  });

  document.getElementById('btn-action-join-room').addEventListener('click', () => {
    const code = document.getElementById('input-portal-room-code').value.trim().toUpperCase();
    const chosenColor = document.querySelector('input[name="join-color"]:checked')?.value || 'green';

    if (!code) {
      alert('Please enter a 5-letter Room Code');
      return;
    }

    network.joinRoom(code, myPlayerName, chosenColor, myAvatar, (res) => {
      if (res && res.success) {
        currentRoomId = res.roomId;
        myOnlineColor = res.myColor;
        showLobbyScreen(res.roomId, res.players, res.hostSocketId === network.socket.id);
      } else {
        alert(res?.error || 'Failed to join room');
      }
    });
  });

  function showLobbyScreen(roomId, players, isHost) {
    switchScreen('lobby');
    document.getElementById('lobby-room-code-display').textContent = roomId;

    const startBtn = document.getElementById('btn-lobby-start-game');
    const addBotBtn = document.getElementById('btn-lobby-add-bot');
    const waitingHint = document.getElementById('lobby-waiting-hint');

    if (startBtn) startBtn.style.display = isHost ? 'block' : 'none';
    if (addBotBtn) addBotBtn.style.display = isHost ? 'block' : 'none';
    if (waitingHint) waitingHint.style.display = isHost ? 'none' : 'block';

    renderLobbySlots(players, network.socket ? network.socket.id : null);
  }

  function renderLobbySlots(players, hostId) {
    const list = document.getElementById('lobby-slots-list');
    const countEl = document.getElementById('lobby-player-count');
    if (!list) return;

    if (countEl) countEl.textContent = players.length;
    list.innerHTML = '';

    players.forEach(p => {
      const card = document.createElement('div');
      card.className = `lobby-slot-card slot-${p.color}`;
      card.innerHTML = `
        <span class="slot-avatar">${p.avatar || '👤'}</span>
        <div class="slot-info">
          <span class="slot-name">${p.name} ${p.isHost ? '👑' : ''} ${p.isBot ? '🤖' : ''}</span>
          <span class="slot-color-tag tag-${p.color}">${capitalize(p.color)}</span>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // Lobby actions
  document.getElementById('btn-lobby-add-bot').addEventListener('click', () => {
    network.addBot((res) => {
      if (res && res.error) alert(res.error);
    });
  });

  document.getElementById('btn-lobby-start-game').addEventListener('click', () => {
    network.startGame((res) => {
      if (res && res.error) alert(res.error);
    });
  });

  document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    network.leaveRoom(() => {
      currentRoomId = null;
      switchScreen('menu');
    });
  });

  // Room sharing buttons
  function getInviteUrl() {
    return window.location.origin + window.location.pathname + '?room=' + currentRoomId;
  }

  document.getElementById('btn-lobby-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomId).then(() => {
      const btn = document.getElementById('btn-lobby-copy');
      btn.textContent = 'Copied! ✓';
      setTimeout(() => { btn.textContent = 'Copy Code 📋'; }, 2000);
    });
  });

  document.getElementById('btn-lobby-share-link').addEventListener('click', () => {
    const url = getInviteUrl();
    if (navigator.share) {
      navigator.share({
        title: 'Play Ludo with me on LOODO!',
        text: `Join my private Ludo room with code: ${currentRoomId}`,
        url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('btn-lobby-share-link');
        btn.textContent = 'Link Copied! ✓';
        setTimeout(() => { btn.textContent = 'Share Invite 🔗'; }, 2000);
      });
    }
  });

  document.getElementById('btn-lobby-whatsapp').addEventListener('click', () => {
    const url = getInviteUrl();
    const text = encodeURIComponent(`🎲 Hey! Play Ludo with me on LOODO!\nClick here to join directly: ${url}\nOr use room code: ${currentRoomId}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  });

  // Top Bar Room Chip copy
  document.getElementById('arena-room-chip').addEventListener('click', () => {
    const url = getInviteUrl();
    navigator.clipboard.writeText(url).then(() => {
      ui.showTurnMessage(`Room link copied to clipboard! 📋`, 'success');
    });
  });

  // ==========================================
  // PASS & PLAY SETUP
  // ==========================================
  document.getElementById('btn-start-pass-game').addEventListener('click', () => {
    const count = parseInt(document.getElementById('select-player-count').value, 10);
    const p1 = document.getElementById('input-p1-name').value.trim() || 'Player 1';
    const p2 = document.getElementById('input-p2-name').value.trim() || 'Player 2';
    const p3 = document.getElementById('input-p3-name').value.trim() || 'Player 3';
    const p4 = document.getElementById('input-p4-name').value.trim() || 'Player 4';

    let config = [];
    if (count === 2) {
      config = [
        { color: 'red', name: p1, isBot: false, active: true, avatar: '🔴' },
        { color: 'yellow', name: p2, isBot: false, active: true, avatar: '🟡' }
      ];
    } else if (count === 3) {
      config = [
        { color: 'red', name: p1, isBot: false, active: true, avatar: '🔴' },
        { color: 'green', name: p2, isBot: false, active: true, avatar: '🟢' },
        { color: 'yellow', name: p3, isBot: false, active: true, avatar: '🟡' }
      ];
    } else {
      config = [
        { color: 'red', name: p1, isBot: false, active: true, avatar: '🔴' },
        { color: 'green', name: p2, isBot: false, active: true, avatar: '🟢' },
        { color: 'yellow', name: p3, isBot: false, active: true, avatar: '🟡' },
        { color: 'blue', name: p4, isBot: false, active: true, avatar: '🔵' }
      ];
    }

    startOfflineGame(config);
  });

  // ==========================================
  // IN-GAME ARENA DRAWERS & CHAT
  // ==========================================
  document.getElementById('btn-arena-menu').addEventListener('click', () => {
    openModal(drawerGameMenu);
  });

  document.getElementById('btn-toggle-chat').addEventListener('click', () => {
    openModal(drawerChat);
    chatUnreadDot.style.display = 'none';
  });

  document.getElementById('btn-drawer-rules').addEventListener('click', () => {
    openModal(modalRules);
  });

  document.getElementById('btn-drawer-exit').addEventListener('click', () => {
    if (confirm('Are you sure you want to return to the Main Menu?')) {
      if (gameMode === 'online') {
        network.leaveRoom();
      }
      closeAllModalsAndDrawers();
      switchScreen('menu');
    }
  });

  document.querySelectorAll('.btn-close-drawer, .btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => closeAllModalsAndDrawers());
  });

  // Chat sending
  const chatInput = document.getElementById('input-chat-text');
  const chatSendBtn = document.getElementById('btn-send-chat');

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';

    if (gameMode === 'online') {
      network.sendChat(text, null);
    } else {
      const activeP = engine.getActivePlayer() || { name: myPlayerName, color: 'red', avatar: myAvatar };
      appendChatMessage({
        senderName: activeP.name,
        senderColor: activeP.color,
        avatar: activeP.avatar,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  }

  if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }

  function appendChatMessage(msg) {
    const container = document.getElementById('chat-messages-list');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `chat-msg msg-${msg.senderColor}`;
    el.innerHTML = `
      <span class="chat-time">${msg.time}</span>
      <strong class="chat-sender">${msg.avatar} ${msg.senderName}:</strong>
      <span class="chat-text">${escapeHtml(msg.text || '')} ${msg.emoji || ''}</span>
    `;

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // Reaction emojis
  document.querySelectorAll('.btn-emoji-reaction').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      if (gameMode === 'online') {
        network.sendChat('', emoji);
      } else {
        const activeColor = engine.getActivePlayer() ? engine.getActivePlayer().color : 'red';
        showFloatingEmoji(emoji, activeColor);
      }
    });
  });

  function showFloatingEmoji(emoji, color) {
    const bubble = document.createElement('div');
    bubble.className = `floating-emoji-bubble bubble-${color}`;
    bubble.textContent = emoji;

    const bRect = boardEl.getBoundingClientRect();
    const x = bRect.left + (bRect.width * (0.35 + Math.random() * 0.3));
    const y = bRect.top + (bRect.height * (0.35 + Math.random() * 0.3));

    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;

    document.body.appendChild(bubble);

    setTimeout(() => {
      bubble.remove();
    }, 1800);
  }

  // Victory modal
  function showVictoryModal(winners, playersList = []) {
    openModal(modalVictory);
    const podiumEl = document.getElementById('victory-podium');
    if (!podiumEl) return;

    podiumEl.innerHTML = '';
    const medals = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place', '4th Place'];

    winners.forEach((color, idx) => {
      const p = playersList.find(pl => pl.color === color) || { name: capitalize(color), avatar: '👑' };
      const row = document.createElement('div');
      row.className = `podium-rank rank-${idx + 1} card-${color}`;
      row.innerHTML = `
        <span class="rank-badge">${medals[idx] || (idx + 1) + 'th'}</span>
        <span class="rank-name">${p.avatar} ${p.name} (${capitalize(color)})</span>
      `;
      podiumEl.appendChild(row);
    });
  }

  document.getElementById('btn-play-again').addEventListener('click', () => {
    closeAllModalsAndDrawers();
    switchScreen('menu');
  });

  // Modal helpers
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
  }

  function closeAllModalsAndDrawers() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================
  // URL QUERY PARAMETER AUTO-JOIN CHECK
  // ==========================================
  const urlParams = new URLSearchParams(window.location.search);
  const autoRoom = urlParams.get('room') || urlParams.get('join') || urlParams.get('code');

  if (autoRoom) {
    // Automatically open Join Room Portal
    switchScreen('portal');
    setPortalTab('join');
    const codeInput = document.getElementById('input-portal-room-code');
    if (codeInput) codeInput.value = autoRoom.toUpperCase();
  } else {
    // Start at Main Menu
    switchScreen('menu');
  }
});

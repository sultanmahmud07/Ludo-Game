const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files with zero-caching during development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Room state store
const rooms = new Map();

// Generate short random room code (5 uppercase alphanumeric chars)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Global Board configuration for server-side validation
const COLOR_START_INDICES = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};

const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

const OPPOSITE_COLORS = {
  red: 'yellow',
  yellow: 'red',
  green: 'blue',
  blue: 'green'
};

class LudoGameRoom {
  constructor(roomId, hostSocketId, hostName, hostColor = 'red', hostAvatar = '👑', hostPlayerId = null) {
    this.roomId = roomId;
    this.hostSocketId = hostSocketId;
    this.status = 'lobby'; // 'lobby' | 'playing' | 'ended'
    this.colors = ['red', 'green', 'yellow', 'blue'];
    this.cleanupTimeout = null;
    
    // Players list: { id, playerId, socketId, name, color, isHost, isBot, isReady, avatar, disconnected }
    this.players = [
      {
        id: hostPlayerId || hostSocketId,
        playerId: hostPlayerId || hostSocketId,
        socketId: hostSocketId,
        name: hostName || 'Player 1',
        color: hostColor,
        isHost: true,
        isBot: false,
        isReady: true,
        avatar: hostAvatar || '👑',
        disconnected: false,
        disconnectedAt: null
      }
    ];

    this.gameState = null;
    this.chatHistory = [];
  }

  addPlayer(socketId, name, preferredColor, avatar, playerId = null) {
    if (this.players.length >= 4) {
      return { error: 'Room is full (max 4 players)' };
    }
    if (this.status !== 'lobby') {
      return { error: 'Game has already started' };
    }

    const takenColors = this.players.map(p => p.color);
    let color = preferredColor;

    // For 2 players: enforce standard cross / opposite position
    if (this.players.length === 1) {
      color = OPPOSITE_COLORS[this.players[0].color] || 'yellow';
    } else {
      if (!color || takenColors.includes(color)) {
        color = this.colors.find(c => !takenColors.includes(c));
      }
    }

    const defaultAvatars = ['🦊', '🐼', '🦁', '🐯', '🦄', '🐲'];
    const chosenAvatar = avatar || defaultAvatars[this.players.length % defaultAvatars.length];

    const player = {
      id: playerId || socketId,
      playerId: playerId || socketId,
      socketId,
      name: name || `Player ${this.players.length + 1}`,
      color,
      isHost: false,
      isBot: false,
      isReady: false,
      avatar: chosenAvatar,
      disconnected: false,
      disconnectedAt: null
    };

    this.players.push(player);
    return { success: true, player };
  }

  addBot(botColor) {
    if (this.players.length >= 4) return { error: 'Room is full' };
    if (this.status !== 'lobby') return { error: 'Game already started' };

    let color = botColor;
    if (this.players.length === 1) {
      // 2nd player is a bot: must be cross (opposite) color
      color = OPPOSITE_COLORS[this.players[0].color] || 'yellow';
    } else {
      const takenColors = this.players.map(p => p.color);
      if (!color || takenColors.includes(color)) {
        color = this.colors.find(c => !takenColors.includes(c));
      }
    }

    if (!color) return { error: 'No available color for bot' };

    const botNames = ['CyberBot', 'NexusAI', 'QuantumBot', 'VortexAI'];
    const botAvatars = ['🤖', '👾', '🚀', '⚡'];
    const botIdx = this.players.filter(p => p.isBot).length;

    const bot = {
      id: 'bot_' + Math.random().toString(36).substr(2, 6),
      playerId: 'bot_' + Math.random().toString(36).substr(2, 6),
      socketId: null,
      name: botNames[botIdx % botNames.length],
      color,
      isHost: false,
      isBot: true,
      isReady: true,
      avatar: botAvatars[botIdx % botAvatars.length],
      disconnected: false,
      disconnectedAt: null
    };

    this.players.push(bot);
    return { success: true, bot };
  }

  removePlayer(identifier) {
    const idx = this.players.findIndex(p => p.socketId === identifier || p.id === identifier || p.playerId === identifier);
    if (idx === -1) return null;

    const removed = this.players.splice(idx, 1)[0];

    // If host left and players remain, assign new host
    if (removed.isHost && this.players.length > 0) {
      const nextHuman = this.players.find(p => !p.isBot) || this.players[0];
      nextHuman.isHost = true;
      this.hostSocketId = nextHuman.socketId;
    }

    return removed;
  }

  changeColor(socketId, newColor) {
    if (this.status !== 'lobby') return false;

    const player = this.players.find(p => p.socketId === socketId);
    if (!player) return false;

    // If 2 players, changing color updates both to maintain cross positions!
    if (this.players.length === 2) {
      player.color = newColor;
      const other = this.players.find(p => p.socketId !== socketId);
      if (other) {
        other.color = OPPOSITE_COLORS[newColor] || 'yellow';
      }
      return true;
    }

    const taken = this.players.some(p => p.color === newColor && p.socketId !== socketId);
    if (taken) return false;

    player.color = newColor;
    return true;
  }

  toggleReady(socketId) {
    const player = this.players.find(p => p.socketId === socketId);
    if (player) {
      player.isReady = !player.isReady;
      return player.isReady;
    }
    return false;
  }

  scheduleCleanupIfEmpty() {
    if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
    const hasConnectedHuman = this.players.some(p => !p.isBot && !p.disconnected);
    if (!hasConnectedHuman) {
      // Keep game alive for 10 minutes so players can refresh or reconnect
      this.cleanupTimeout = setTimeout(() => {
        const stillEmpty = this.players.some(p => !p.isBot && !p.disconnected);
        if (!stillEmpty) {
          rooms.delete(this.roomId);
        }
      }, 600000);
    }
  }

  initGame() {
    this.status = 'playing';

    // Standard 2-player rule: ensure 2 players are cross / opposite!
    if (this.players.length === 2) {
      this.players[1].color = OPPOSITE_COLORS[this.players[0].color] || 'yellow';
    }

    // Standard turn sequence: red -> green -> yellow -> blue
    const order = ['red', 'green', 'yellow', 'blue'];
    this.players.sort((a, b) => order.indexOf(a.color) - order.indexOf(b.color));

    // Token positions: ONLY for active players! Inactive colors have no tokens!
    const tokens = {};
    this.players.forEach(p => {
      tokens[p.color] = [-1, -1, -1, -1];
    });

    this.gameState = {
      currentTurnIndex: 0,
      activeColor: this.players[0].color,
      diceValue: null,
      hasRolled: false,
      consecutiveSixes: 0,
      tokens,
      validTokens: [],
      winners: [], // finished players in order
      turnTimer: 30
    };

    return this.gameState;
  }

  getValidMoves(color, roll) {
    if (!this.gameState) return [];
    const playerTokens = this.gameState.tokens[color];
    const valid = [];

    playerTokens.forEach((step, tokenIdx) => {
      // In yard: requires 6 to enter start cell (step 0)
      if (step === -1) {
        if (roll === 6) valid.push(tokenIdx);
      } else if (step >= 0 && step < 56) {
        // Can only move if not overshooting 56
        if (step + roll <= 56) {
          valid.push(tokenIdx);
        }
      }
    });

    return valid;
  }

  executeMove(color, tokenIdx, roll) {
    if (!this.gameState) return null;
    const currentStep = this.gameState.tokens[color][tokenIdx];
    let newStep = currentStep;

    if (currentStep === -1) {
      newStep = 0;
    } else {
      newStep = currentStep + roll;
    }

    this.gameState.tokens[color][tokenIdx] = newStep;

    // Check for captures
    let captured = null;
    if (newStep >= 0 && newStep <= 50) {
      const globalIndex = (COLOR_START_INDICES[color] + newStep) % 52;
      const isSafe = SAFE_INDICES.includes(globalIndex);

      if (!isSafe) {
        // Check opponent tokens
        for (const [otherColor, otherTokens] of Object.entries(this.gameState.tokens)) {
          if (otherColor === color) continue;
          otherTokens.forEach((otherStep, otherIdx) => {
            if (otherStep >= 0 && otherStep <= 50) {
              const otherGlobalIndex = (COLOR_START_INDICES[otherColor] + otherStep) % 52;
              if (otherGlobalIndex === globalIndex) {
                // Captured!
                this.gameState.tokens[otherColor][otherIdx] = -1; // back to yard
                captured = { color: otherColor, tokenIdx: otherIdx };
              }
            }
          });
        }
      }
    }

    // Check if player completed this token
    const reachedHome = (newStep === 56);

    // Check if player won
    const allHome = this.gameState.tokens[color].every(s => s === 56);
    let playerWon = false;
    if (allHome && !this.gameState.winners.includes(color)) {
      this.gameState.winners.push(color);
      playerWon = true;
    }

    // Extra roll granted if: rolled 6, captured enemy, or reached home
    const extraRoll = (roll === 6 || captured !== null || reachedHome);

    return {
      color,
      tokenIdx,
      oldStep: currentStep,
      newStep,
      captured,
      reachedHome,
      playerWon,
      extraRoll
    };
  }

  nextTurn() {
    if (!this.gameState) return;

    this.gameState.diceValue = null;
    this.gameState.hasRolled = false;
    this.gameState.validTokens = [];

    // Advance to next active player who hasn't finished yet
    const totalPlayers = this.players.length;
    let attempts = 0;
    do {
      this.gameState.currentTurnIndex = (this.gameState.currentTurnIndex + 1) % totalPlayers;
      const nextPlayer = this.players[this.gameState.currentTurnIndex];
      if (!this.gameState.winners.includes(nextPlayer.color)) {
        this.gameState.activeColor = nextPlayer.color;
        break;
      }
      attempts++;
    } while (attempts < totalPlayers);

    // Reset consecutive 6s for new turn
    this.gameState.consecutiveSixes = 0;

    // Check if all but one player finished
    if (this.gameState.winners.length >= totalPlayers - 1) {
      this.status = 'ended';
    }

    this.checkBotTurn();
  }

  checkBotTurn() {
    if (this.status !== 'playing' || !this.gameState) return;
    const activePlayer = this.players[this.gameState.currentTurnIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    // Bot will roll after a short natural delay (800ms)
    setTimeout(() => {
      if (this.status !== 'playing' || !this.gameState) return;
      const curPlayer = this.players[this.gameState.currentTurnIndex];
      if (!curPlayer || !curPlayer.isBot || this.gameState.hasRolled) return;

      const roll = Math.floor(Math.random() * 6) + 1;
      this.gameState.diceValue = roll;
      this.gameState.hasRolled = true;

      if (roll === 6) {
        this.gameState.consecutiveSixes++;
      } else {
        this.gameState.consecutiveSixes = 0;
      }

      if (this.gameState.consecutiveSixes >= 3) {
        io.to(this.roomId).emit('dice_rolled', {
          roll,
          activeColor: curPlayer.color,
          consecutiveSixesPenalty: true
        });
        setTimeout(() => {
          this.nextTurn();
          io.to(this.roomId).emit('turn_changed', { gameState: this.gameState });
        }, 1200);
        return;
      }

      const validMoves = this.getValidMoves(curPlayer.color, roll);
      this.gameState.validTokens = validMoves;

      io.to(this.roomId).emit('dice_rolled', {
        roll,
        activeColor: curPlayer.color,
        validTokens: validMoves
      });

      if (validMoves.length === 0) {
        setTimeout(() => {
          this.nextTurn();
          io.to(this.roomId).emit('turn_changed', { gameState: this.gameState });
        }, 1200);
      } else {
        // Pick best move with simple smart heuristic
        setTimeout(() => {
          if (this.status !== 'playing' || !this.gameState) return;
          const chosenIdx = this.chooseBestBotMove(curPlayer.color, validMoves, roll);
          const moveResult = this.executeMove(curPlayer.color, chosenIdx, roll);

          io.to(this.roomId).emit('token_moved', {
            moveResult,
            gameState: this.gameState
          });

          if (this.status === 'ended') {
            io.to(this.roomId).emit('game_ended', { winners: this.gameState.winners });
            return;
          }

          if (moveResult.extraRoll) {
            this.gameState.hasRolled = false;
            this.gameState.diceValue = null;
            this.gameState.validTokens = [];
            io.to(this.roomId).emit('turn_extra_roll', {
              activeColor: curPlayer.color,
              reason: moveResult.captured ? 'captured' : (moveResult.reachedHome ? 'home' : 'six')
            });
            // Bot rolls again!
            this.checkBotTurn();
          } else {
            this.nextTurn();
            io.to(this.roomId).emit('turn_changed', { gameState: this.gameState });
          }
        }, 900);
      }
    }, 800);
  }

  chooseBestBotMove(color, validMoves, roll) {
    if (validMoves.length === 1) return validMoves[0];

    const tokens = this.gameState.tokens[color];
    let bestScore = -9999;
    let bestIdx = validMoves[0];

    for (const idx of validMoves) {
      const step = tokens[idx];
      let score = 0;

      // 1. Move into home is top priority
      if (step + roll === 56) {
        score += 500;
      }

      // 2. Capture opponent token
      if (step === -1) {
        // Moving out of base
        score += 150;
      } else {
        const nextStep = step + roll;
        if (nextStep <= 50) {
          const globalIdx = (COLOR_START_INDICES[color] + nextStep) % 52;
          if (!SAFE_INDICES.includes(globalIdx)) {
            for (const [oppColor, oppTokens] of Object.entries(this.gameState.tokens)) {
              if (oppColor === color) continue;
              oppTokens.forEach(oppStep => {
                if (oppStep >= 0 && oppStep <= 50) {
                  const oppGlobal = (COLOR_START_INDICES[oppColor] + oppStep) % 52;
                  if (oppGlobal === globalIdx) {
                    score += 300; // Big capture bonus!
                  }
                }
              });
            }
          } else {
            // Landing on safe spot
            score += 80;
          }
        } else if (nextStep > 50) {
          // Entering home corridor
          score += 100;
        }

        // Favor moving advanced tokens
        score += step * 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    return bestIdx;
  }
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  // Create room
  socket.on('create_room', ({ playerName, color, avatar, playerId }, callback) => {
    let roomId = generateRoomCode();
    while (rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const room = new LudoGameRoom(roomId, socket.id, playerName, color, avatar, playerId);
    rooms.set(roomId, room);
    currentRoomId = roomId;

    socket.join(roomId);
    if (typeof callback === 'function') {
      callback({
        success: true,
        roomId,
        players: room.players,
        hostSocketId: room.hostSocketId,
        myColor: color
      });
    }
  });

  // Join room
  socket.on('join_room', ({ roomId, playerName, color, avatar, playerId }, callback) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    const room = rooms.get(cleanRoomId);

    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found. Please check the code.' });
      return;
    }

    // Check if this is a reconnecting player
    let existingPlayer = room.players.find(p => (playerId && (p.playerId === playerId || p.id === playerId)));
    if (!existingPlayer && playerName) {
      existingPlayer = room.players.find(p => p.name === playerName && p.disconnected);
    }
    if (!existingPlayer && room.status === 'playing') {
      existingPlayer = room.players.find(p => p.disconnected && !p.isBot);
    }

    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.disconnected = false;
      existingPlayer.disconnectedAt = null;
      if (existingPlayer.isHost) {
        room.hostSocketId = socket.id;
      }
      currentRoomId = cleanRoomId;
      socket.join(cleanRoomId);

      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
        room.cleanupTimeout = null;
      }

      io.to(cleanRoomId).emit('player_status_changed', {
        color: existingPlayer.color,
        name: existingPlayer.name,
        connected: true
      });

      io.to(cleanRoomId).emit('room_updated', {
        players: room.players,
        status: room.status,
        hostSocketId: room.hostSocketId
      });

      if (typeof callback === 'function') {
        callback({
          success: true,
          isRejoin: true,
          roomId: cleanRoomId,
          status: room.status,
          players: room.players,
          hostSocketId: room.hostSocketId,
          myColor: existingPlayer.color,
          gameState: room.gameState,
          chatHistory: room.chatHistory
        });
      }
      return;
    }

    if (room.status !== 'lobby') {
      if (typeof callback === 'function') callback({ error: 'Game has already started in this room' });
      return;
    }

    const result = room.addPlayer(socket.id, playerName, color, avatar, playerId);
    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    currentRoomId = cleanRoomId;
    socket.join(cleanRoomId);

    io.to(cleanRoomId).emit('room_updated', {
      players: room.players,
      status: room.status,
      hostSocketId: room.hostSocketId
    });

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomId: cleanRoomId,
        players: room.players,
        hostSocketId: room.hostSocketId,
        myColor: result.player.color
      });
    }
  });

  // Rejoin room (called on page reload)
  socket.on('rejoin_room', ({ roomId, playerId, playerName }, callback) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    const room = rooms.get(cleanRoomId);

    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found or game ended' });
      return;
    }

    let player = room.players.find(p => (playerId && (p.playerId === playerId || p.id === playerId)));
    if (!player && playerName) {
      player = room.players.find(p => p.name === playerName && p.disconnected);
    }
    if (!player) {
      player = room.players.find(p => p.disconnected && !p.isBot);
    }

    if (!player) {
      if (typeof callback === 'function') callback({ error: 'Player seat not found in room' });
      return;
    }

    player.socketId = socket.id;
    player.disconnected = false;
    player.disconnectedAt = null;
    if (player.isHost) {
      room.hostSocketId = socket.id;
    }
    currentRoomId = cleanRoomId;
    socket.join(cleanRoomId);

    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
      room.cleanupTimeout = null;
    }

    io.to(cleanRoomId).emit('player_status_changed', {
      color: player.color,
      name: player.name,
      connected: true
    });

    io.to(cleanRoomId).emit('room_updated', {
      players: room.players,
      status: room.status,
      hostSocketId: room.hostSocketId
    });

    if (typeof callback === 'function') {
      callback({
        success: true,
        isRejoin: true,
        roomId: cleanRoomId,
        status: room.status,
        players: room.players,
        hostSocketId: room.hostSocketId,
        myColor: player.color,
        gameState: room.gameState,
        chatHistory: room.chatHistory
      });
    }
  });

  // Get room preview info
  socket.on('get_room_info', ({ roomId }, callback) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    const room = rooms.get(cleanRoomId);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found' });
      return;
    }
    if (typeof callback === 'function') {
      callback({
        success: true,
        roomId: cleanRoomId,
        playerCount: room.players.length,
        status: room.status,
        takenColors: room.players.map(p => p.color)
      });
    }
  });

  // Leave room
  socket.on('leave_room', ({ roomId }, callback) => {
    const cleanRoomId = (roomId || currentRoomId || '').trim().toUpperCase();
    const room = rooms.get(cleanRoomId);
    if (room) {
      socket.leave(cleanRoomId);
      const removed = room.removePlayer(socket.id);
      if (removed) {
        if (room.players.length === 0) {
          rooms.delete(cleanRoomId);
        } else {
          io.to(cleanRoomId).emit('room_updated', {
            players: room.players,
            status: room.status,
            hostSocketId: room.hostSocketId
          });
        }
      }
    }
    currentRoomId = null;
    if (typeof callback === 'function') callback({ success: true });
  });

  // Add bot
  socket.on('add_bot', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) {
      if (typeof callback === 'function') callback({ error: 'Only host can add bots' });
      return;
    }

    const result = room.addBot();
    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    io.to(roomId).emit('room_updated', {
      players: room.players,
      status: room.status,
      hostSocketId: room.hostSocketId
    });

    if (typeof callback === 'function') callback({ success: true });
  });

  // Change color
  socket.on('change_color', ({ roomId, color }, callback) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const ok = room.changeColor(socket.id, color);
    if (ok) {
      io.to(roomId).emit('room_updated', {
        players: room.players,
        status: room.status,
        hostSocketId: room.hostSocketId
      });
      if (typeof callback === 'function') callback({ success: true });
    } else {
      if (typeof callback === 'function') callback({ error: 'Color already taken' });
    }
  });

  // Toggle ready
  socket.on('toggle_ready', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.toggleReady(socket.id);
    io.to(roomId).emit('room_updated', {
      players: room.players,
      status: room.status,
      hostSocketId: room.hostSocketId
    });
  });

  // Start game
  socket.on('start_game', ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (!room || room.hostSocketId !== socket.id) {
      if (typeof callback === 'function') callback({ error: 'Only host can start the game' });
      return;
    }
    if (room.players.length < 2) {
      if (typeof callback === 'function') callback({ error: 'Need at least 2 players to start' });
      return;
    }

    const gameState = room.initGame();
    io.to(roomId).emit('game_started', {
      gameState,
      players: room.players
    });

    room.checkBotTurn();

    if (typeof callback === 'function') callback({ success: true });
  });

  // Roll dice
  socket.on('roll_dice', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing' || !room.gameState) return;

    const activePlayer = room.players[room.gameState.currentTurnIndex];
    if (activePlayer.socketId !== socket.id) return; // not your turn
    if (room.gameState.hasRolled) return; // already rolled

    const roll = Math.floor(Math.random() * 6) + 1;
    room.gameState.diceValue = roll;
    room.gameState.hasRolled = true;

    if (roll === 6) {
      room.gameState.consecutiveSixes++;
    } else {
      room.gameState.consecutiveSixes = 0;
    }

    // Rule: 3 consecutive sixes forfeits turn
    if (room.gameState.consecutiveSixes >= 3) {
      io.to(roomId).emit('dice_rolled', {
        roll,
        activeColor: activePlayer.color,
        consecutiveSixesPenalty: true
      });

      setTimeout(() => {
        room.nextTurn();
        io.to(roomId).emit('turn_changed', {
          gameState: room.gameState
        });
      }, 1200);
      return;
    }

    const validMoves = room.getValidMoves(activePlayer.color, roll);
    room.gameState.validTokens = validMoves;

    io.to(roomId).emit('dice_rolled', {
      roll,
      activeColor: activePlayer.color,
      validTokens: validMoves
    });

    // If no valid moves, auto pass turn after brief delay
    if (validMoves.length === 0) {
      setTimeout(() => {
        room.nextTurn();
        io.to(roomId).emit('turn_changed', {
          gameState: room.gameState
        });
      }, 1200);
    }
  });

  // Move token
  socket.on('move_token', ({ roomId, tokenIdx }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing' || !room.gameState) return;

    const activePlayer = room.players[room.gameState.currentTurnIndex];
    if (activePlayer.socketId !== socket.id) return;
    if (!room.gameState.hasRolled) return;
    if (!room.gameState.validTokens.includes(tokenIdx)) return;

    const moveResult = room.executeMove(activePlayer.color, tokenIdx, room.gameState.diceValue);

    io.to(roomId).emit('token_moved', {
      moveResult,
      gameState: room.gameState
    });

    // Check if game ended
    if (room.status === 'ended') {
      io.to(roomId).emit('game_ended', {
        winners: room.gameState.winners
      });
      return;
    }

    // If extra roll, reset hasRolled so same player can roll again
    if (moveResult.extraRoll) {
      room.gameState.hasRolled = false;
      room.gameState.diceValue = null;
      room.gameState.validTokens = [];
      io.to(roomId).emit('turn_extra_roll', {
        activeColor: activePlayer.color,
        reason: moveResult.captured ? 'captured' : (moveResult.reachedHome ? 'home' : 'six')
      });
    } else {
      room.nextTurn();
      io.to(roomId).emit('turn_changed', {
        gameState: room.gameState
      });
    }
  });

  // Chat message & emoticons
  socket.on('send_chat', ({ roomId, text, emoji }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const sender = room.players.find(p => p.socketId === socket.id);
    const msg = {
      senderName: sender ? sender.name : 'Spectator',
      senderColor: sender ? sender.color : 'white',
      avatar: sender ? sender.avatar : '👤',
      text: text || '',
      emoji: emoji || null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    room.chatHistory.push(msg);
    if (room.chatHistory.length > 50) room.chatHistory.shift();

    io.to(roomId).emit('new_chat', msg);
  });

  // Disconnect handler (with reload & reconnection grace period)
  socket.on('disconnect', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    if (room.status === 'playing') {
      player.disconnected = true;
      player.disconnectedAt = Date.now();
      io.to(currentRoomId).emit('player_status_changed', {
        color: player.color,
        name: player.name,
        connected: false
      });
      room.scheduleCleanupIfEmpty();
    } else {
      // In lobby: 20-second grace period for quick page refreshes
      player.disconnected = true;
      player.disconnectedAt = Date.now();
      setTimeout(() => {
        if (player.disconnected && room.status === 'lobby') {
          room.removePlayer(player.id);
          if (room.players.length === 0) {
            rooms.delete(currentRoomId);
          } else {
            io.to(currentRoomId).emit('room_updated', {
              players: room.players,
              status: room.status,
              hostSocketId: room.hostSocketId
            });
          }
        }
      }, 20000);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✨ Loodo Server is running live on http://localhost:${PORT}`);
});

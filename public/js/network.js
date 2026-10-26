// Socket.IO Network Client for Online Multiplayer
class NetworkClient {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.myColor = null;
    this.isConnected = false;

    // Event hooks
    this.onRoomUpdated = null;
    this.onGameStarted = null;
    this.onDiceRolled = null;
    this.onTokenMoved = null;
    this.onTurnChanged = null;
    this.onExtraRoll = null;
    this.onGameEnded = null;
    this.onNewChat = null;
    this.onConnectError = null;
  }

  connect() {
    if (this.socket && this.socket.connected) return;

    if (typeof io === 'undefined') {
      console.warn('Socket.io client library not loaded');
      return;
    }

    this.socket = io();

    this.socket.on('connect', () => {
      this.isConnected = true;
    });

    this.socket.on('connect_error', (err) => {
      this.isConnected = false;
      if (this.onConnectError) this.onConnectError(err);
    });

    this.socket.on('room_updated', (data) => {
      if (this.onRoomUpdated) this.onRoomUpdated(data);
    });

    this.socket.on('game_started', (data) => {
      if (this.onGameStarted) this.onGameStarted(data);
    });

    this.socket.on('dice_rolled', (data) => {
      if (this.onDiceRolled) this.onDiceRolled(data);
    });

    this.socket.on('token_moved', (data) => {
      if (this.onTokenMoved) this.onTokenMoved(data);
    });

    this.socket.on('turn_changed', (data) => {
      if (this.onTurnChanged) this.onTurnChanged(data);
    });

    this.socket.on('turn_extra_roll', (data) => {
      if (this.onExtraRoll) this.onExtraRoll(data);
    });

    this.socket.on('game_ended', (data) => {
      if (this.onGameEnded) this.onGameEnded(data);
    });

    this.socket.on('new_chat', (data) => {
      if (this.onNewChat) this.onNewChat(data);
    });
  }

  createRoom(playerName, color, avatar, callback) {
    this.connect();
    this.socket.emit('create_room', { playerName, color, avatar }, (res) => {
      if (res && res.success) {
        this.roomId = res.roomId;
        this.myColor = color;
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  joinRoom(roomId, playerName, color, avatar, callback) {
    this.connect();
    this.socket.emit('join_room', { roomId, playerName, color, avatar }, (res) => {
      if (res && res.success) {
        this.roomId = res.roomId;
        this.myColor = res.myColor;
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  getRoomInfo(roomId, callback) {
    this.connect();
    this.socket.emit('get_room_info', { roomId }, callback);
  }

  leaveRoom(callback) {
    if (!this.roomId) {
      if (typeof callback === 'function') callback({ success: true });
      return;
    }
    this.socket.emit('leave_room', { roomId: this.roomId }, (res) => {
      this.roomId = null;
      this.myColor = null;
      if (typeof callback === 'function') callback(res);
    });
  }

  addBot(callback) {
    if (!this.roomId) return;
    this.socket.emit('add_bot', { roomId: this.roomId }, callback);
  }

  changeColor(newColor, callback) {
    if (!this.roomId) return;
    this.socket.emit('change_color', { roomId: this.roomId, color: newColor }, (res) => {
      if (res && res.success) {
        this.myColor = newColor;
      }
      if (typeof callback === 'function') callback(res);
    });
  }

  toggleReady() {
    if (!this.roomId) return;
    this.socket.emit('toggle_ready', { roomId: this.roomId });
  }

  startGame(callback) {
    if (!this.roomId) return;
    this.socket.emit('start_game', { roomId: this.roomId }, callback);
  }

  rollDice() {
    if (!this.roomId) return;
    this.socket.emit('roll_dice', { roomId: this.roomId });
  }

  moveToken(tokenIdx) {
    if (!this.roomId) return;
    this.socket.emit('move_token', { roomId: this.roomId, tokenIdx });
  }

  sendChat(text, emoji) {
    if (!this.roomId) return;
    this.socket.emit('send_chat', { roomId: this.roomId, text, emoji });
  }
}

window.NetworkClient = NetworkClient;

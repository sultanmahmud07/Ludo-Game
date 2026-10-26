// Ludo 15x15 Coordinate System and Complete Path Mapping
const BoardData = {
  GRID_SIZE: 15,

  // 52 Perimeter track coordinates: [row, col]
  TRACK_COORDINATES: [
    [6, 1],  // 0: Red Start (Star)
    [6, 2],  // 1
    [6, 3],  // 2
    [6, 4],  // 3
    [6, 5],  // 4
    [5, 6],  // 5
    [4, 6],  // 6
    [3, 6],  // 7
    [2, 6],  // 8: Star Safe
    [1, 6],  // 9
    [0, 6],  // 10
    [0, 7],  // 11
    [0, 8],  // 12
    [1, 8],  // 13: Green Start (Star)
    [2, 8],  // 14
    [3, 8],  // 15
    [4, 8],  // 16
    [5, 8],  // 17
    [6, 9],  // 18
    [6, 10], // 19
    [6, 11], // 20
    [6, 12], // 21: Star Safe
    [6, 13], // 22
    [6, 14], // 23
    [7, 14], // 24
    [8, 14], // 25
    [8, 13], // 26: Yellow Start (Star)
    [8, 12], // 27
    [8, 11], // 28
    [8, 10], // 29
    [8, 9],  // 30
    [9, 8],  // 31
    [10, 8], // 32
    [11, 8], // 33
    [12, 8], // 34: Star Safe
    [13, 8], // 35
    [14, 8], // 36
    [14, 7], // 37
    [14, 6], // 38
    [13, 6], // 39: Blue Start (Star)
    [12, 6], // 40
    [11, 6], // 41
    [10, 6], // 42
    [9, 6],  // 43
    [8, 5],  // 44
    [8, 4],  // 45
    [8, 3],  // 46
    [8, 2],  // 47: Star Safe
    [8, 1],  // 48
    [8, 0],  // 49
    [7, 0],  // 50
    [6, 0]   // 51
  ],

  // Starting track index for each color
  COLOR_START_INDEX: {
    red: 0,
    green: 13,
    yellow: 26,
    blue: 39
  },

  // Safe global track indices (tokens here cannot be captured)
  SAFE_TRACK_INDICES: [0, 8, 13, 21, 26, 34, 39, 47],

  // Home corridor coordinates (step 51..55) for each color: [row, col]
  HOME_CORRIDORS: {
    red: [
      [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]
    ],
    green: [
      [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]
    ],
    yellow: [
      [7, 13], [7, 12], [7, 11], [7, 10], [7, 9]
    ],
    blue: [
      [13, 7], [12, 7], [11, 7], [10, 7], [9, 7]
    ]
  },

  // Final home goal target inside center triangle (step 56)
  HOME_GOALS: {
    red: [7, 6.2],
    green: [6.2, 7],
    yellow: [7, 7.8],
    blue: [7.8, 7]
  },

  // Yard base slot coordinates for each color (step -1): 4 slots per yard
  YARD_SLOTS: {
    red: [
      [1.8, 1.8], [1.8, 3.8],
      [3.8, 1.8], [3.8, 3.8]
    ],
    green: [
      [1.8, 10.8], [1.8, 12.8],
      [3.8, 10.8], [3.8, 12.8]
    ],
    yellow: [
      [10.8, 10.8], [10.8, 12.8],
      [12.8, 10.8], [12.8, 12.8]
    ],
    blue: [
      [10.8, 1.8], [10.8, 3.8],
      [12.8, 1.8], [12.8, 3.8]
    ]
  },

  // Helper: get exact board coordinates [row, col] for a token
  getTokenCoordinates(color, tokenIdx, step) {
    if (step === -1) {
      return this.YARD_SLOTS[color][tokenIdx];
    }
    if (step >= 0 && step <= 50) {
      const globalIdx = (this.COLOR_START_INDEX[color] + step) % 52;
      return this.TRACK_COORDINATES[globalIdx];
    }
    if (step >= 51 && step <= 55) {
      const homeStepIdx = step - 51;
      return this.HOME_CORRIDORS[color][homeStepIdx];
    }
    if (step === 56) {
      // Offset slightly per token in goal so they stack neatly
      const base = this.HOME_GOALS[color];
      const offsets = [
        [0, 0],
        [-0.15, 0.15],
        [0.15, -0.15],
        [0.15, 0.15]
      ];
      return [base[0] + offsets[tokenIdx][0], base[1] + offsets[tokenIdx][1]];
    }
    return [0, 0];
  },

  // Helper: check if a global track index is safe
  isSafeCell(trackIndex) {
    return this.SAFE_TRACK_INDICES.includes(trackIndex);
  }
};

window.BoardData = BoardData;

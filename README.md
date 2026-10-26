# 🎲 LOODO - Modern Glassmorphic Ludo Game

A modern, authentic, and high-performance **Ludo Game** built with a **Glassmorphism UI**, full offline capability (Solo vs AI, Pass & Play), and real-time online multiplayer.

---

## ✨ Features & Highlights

### 1. 🎨 Modern Glassmorphic Design
- **Frosted Glass Components**: Translucent panels with dynamic background refraction (`backdrop-filter: blur(24px)`), subtle borders (`rgba(255, 255, 255, 0.12)`), and deep specular shadows.
- **Ambient Lighting**: Floating colorful ambient mesh orbs in Red, Green, Yellow, and Blue reflecting the players' themes.
- **Vibrant Color Palette**:
  - 🔴 **Red**: Crimson Glow (`#FF3366`)
  - 🟢 **Green**: Emerald Glow (`#00E676`)
  - 🟡 **Yellow**: Golden Amber Glow (`#FFD600`)
  - 🔵 **Blue**: Electric Cyan Glow (`#00D2FF`)
- **Typography**: Modern Google Fonts ([Outfit](https://fonts.google.com/specimen/Outfit) and [Inter](https://fonts.google.com/specimen/Inter)).

### 2. 🎲 3D Interactive Dice
- Built with CSS 3D transforms (`transform-style: preserve-3d; perspective: 700px;`).
- Realistic tumbling rotation physics on roll.
- Illuminated glowing pips customized to the active player's color.
- Supports both **mouse click** and **Spacebar keypress** to roll.

### 3. 🎯 Authentic International Ludo Rules
- **15x15 Standard Board**: Fully detailed track with 52 perimeter steps, 4 home yards, 4 home corridors, and central finish trophy apex.
- **Release Rule**: Rolling a **6** is required to bring a token out of the yard onto the starting cell.
- **Bonus Rolls (Extra Turns)**:
  - Rolling a **6** grants an extra roll.
  - Capturing an opponent token grants an extra roll.
  - Bringing a token into the home center grants an extra roll.
- **Consecutive 6s Penalty**: Rolling three 6s in a row forfeits the turn to prevent infinite loops.
- **Safe Zones**: 8 Star Cells (★) protect tokens from being captured.
- **Token Hopping Animation**: Step-by-step fluid hopping movement with pitch-ascending melodic pluck audio.
- **Movable Token Highlighting**: Automatically highlights legal tokens with pulsing neon rings and subtle hovering lift.

### 4. 👥 Game Modes & Room System

| Mode | Type | Description |
| :--- | :--- | :--- |
| **Play With Friends** | Online Multiplayer | Create a private room with a 5-letter code, share with 1-tap via WhatsApp / Link / Code, customize your avatar, and add AI bots to empty seats. |
| **Play vs Computer** | Solo Offline | Practice against 1–3 intelligent heuristic AI bots with real-time decision making. |
| **Pass & Play** | Local Offline | Play on the same phone/tablet with 2, 3, or 4 friends with customizable names. |

### 5. 📱 Mobile-First 4-Corner UI
- **Single-Screen Fit**: The board, 4 player status badges, reaction dock, and 3D dice all fit cleanly on mobile screens (`375px` to `430px`) without vertical or horizontal scrolling.
- **Physical Corner Mapping**:
  - Top-Left: Red Player Badge (aligned with Red yard)
  - Top-Right: Green Player Badge (aligned with Green yard)
  - Bottom-Left: Blue Player Badge (aligned with Blue yard)
  - Bottom-Right: Yellow Player Badge (aligned with Yellow yard)
- **Direct Link Auto-Join**: Share links like `http://localhost:3000/?room=7K9A` automatically pre-fill the room code on your friends' phones!

### 5. 🔊 Web Audio API Sound Engine
100% self-contained audio synthesis — no external `.mp3` files or missing assets:
- **Dice Roll**: Tumbling dice rattle and landing clatter.
- **Token Steps**: Melodic marimba pluck tones.
- **Captures**: Heavy bass punch and electric zap effect.
- **Safe Spots**: Angelic chime arpeggios.
- **Victory**: Grand fanfare melody accompanied by full-screen particle confetti.
- **Mute Toggle**: Persistent sound toggle saved to `localStorage`.

---

## 🚀 How to Run Locally

### Start Server
```bash
npm run dev
# or
npm start
```
Open in your browser:
**[http://localhost:3000](http://localhost:3000)**

---

## 📁 Project Structure

```
/Users/sultan/Projects/Loodo/
├── server.js              # Express & Socket.IO server with room management & bot turns
├── package.json           # Dependencies and startup scripts
└── public/
    ├── index.html         # Semantic HTML5 layout with board, sidebars, and modals
    ├── css/
    │   ├── style.css      # Glassmorphism design system, layout, and animations
    │   ├── board.css      # 15x15 Ludo grid, token 3D styling, and yards
    │   ├── dice.css       # 3D interactive dice transforms and pips
    │   └── modal.css      # Mode selection, lobby, rules, and victory podium
    └── js/
        ├── audio.js       # Web Audio API sound synthesizers
        ├── board-data.js  # 15x15 coordinate mappings, 52 track cells, and star spots
        ├── game-engine.js # Core Ludo rule engine for local play
        ├── ai.js          # Heuristic bot decision engine
        ├── network.js     # Socket.IO online multiplayer client
        ├── dice.js        # 3D dice physics and rotation controller
        ├── particles.js   # Canvas confetti & celebration fireworks
        ├── ui.js          # DOM renderer, token hopper, and turn announcer
        └── app.js         # Master game orchestrator
```

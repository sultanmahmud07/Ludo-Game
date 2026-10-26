// 3D Realistic Interactive Dice Controller
class DiceController {
  constructor(cubeElement, onRollComplete) {
    this.cube = cubeElement;
    this.onRollComplete = onRollComplete;
    this.isRolling = false;
    this.currentValue = 1;
    this.spinCount = 0;

    // Face rotations to bring face to front
    this.faceRotations = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: -90 },
      3: { x: -90, y: 0 },
      4: { x: 90, y: 0 },
      5: { x: 0, y: 90 },
      6: { x: 0, y: 180 }
    };
  }

  setDiceColor(color) {
    if (!this.cube) return;
    this.cube.setAttribute('data-color', color);
  }

  roll(targetValue, callback) {
    if (this.isRolling || !this.cube) return;
    this.isRolling = true;
    this.currentValue = targetValue;
    this.spinCount++;

    if (window.soundCtrl) {
      window.soundCtrl.playDiceRoll();
    }

    // Add tumbling animation
    this.cube.classList.add('rolling');

    // Extra full spins so it tumbles dynamically
    const extraSpinsX = (this.spinCount % 2 === 0 ? 720 : 1080);
    const extraSpinsY = (this.spinCount % 2 === 0 ? 1080 : 720);
    const targetRot = this.faceRotations[targetValue] || { x: 0, y: 0 };

    const finalX = targetRot.x + extraSpinsX;
    const finalY = targetRot.y + extraSpinsY;

    // Smooth transition to target
    this.cube.style.transition = 'transform 0.85s cubic-bezier(0.2, 0.9, 0.3, 1.1)';
    this.cube.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;

    setTimeout(() => {
      this.cube.classList.remove('rolling');
      this.isRolling = false;
      if (typeof callback === 'function') callback(targetValue);
      if (this.onRollComplete) this.onRollComplete(targetValue);
    }, 850);
  }

  setValueInstant(val) {
    if (!this.cube) return;
    const rot = this.faceRotations[val] || { x: 0, y: 0 };
    this.cube.style.transition = 'none';
    this.cube.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
    this.currentValue = val;
  }
}

window.DiceController = DiceController;

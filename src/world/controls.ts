  private onPointerUp = (e: PointerEvent): void => {
    if (this.lookPointer !== e.pointerId) return;
    this.lookPointer = null;
    const quick = performance.now() - this.pressedAt < TAP_MS;
    const still =
      Math.abs(e.clientX - this.pressedPos.x) < TAP_SLOP &&
      Math.abs(e.clientY - this.pressedPos.y) < TAP_SLOP &&
      this.moved < TAP_SLOP * 2;
    if (this.enabled && !this.orbitMode && quick && still) {
      this.onTap({ x: e.clientX, y: e.clientY });
    }
  };

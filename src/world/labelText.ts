/**
 * Text that fits the plate it is painted on.
 *
 * The door and station labels are canvas textures of a fixed width, and the
 * strings that go on them are written by hand in `STATION_INFO` and the room
 * definitions. "The Resolute Desk" fits at 34px. "The Motorcade to the
 * Capitol" does not, and a sprite has no overflow rule — the glyphs simply
 * run off both ends of the plate and hang in the air.
 *
 * So the size is measured rather than assumed: start at the size the label
 * was designed for and step down until the string fits inside the plate.
 * Nothing gets clipped, and the labels that already fit are untouched.
 */
export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: string,
  basePx: number,
  family: string,
  minPx = 18,
): void {
  let size = basePx;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }
}

/**
 * A soft shadow under label text.
 *
 * The plates sit in rooms lit anywhere from firelight to a blown-out window,
 * and a flat fill that reads on one wall disappears on another. A shadow
 * costs nothing and holds the letters together over any background.
 */
export function withTextShadow(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 1;
  draw();
  ctx.restore();
}

// Canvas 2D usage - no WebGL, but test canvas detection
export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D not supported');
  }
  return { canvas, ctx };
}

export function drawFloor(canvas: HTMLCanvasElement, color: string) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

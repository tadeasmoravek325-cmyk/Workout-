/** Contour lines like a map, as an SVG data URI for the page background. */
export function topoDataUri(stroke: string, opacity: number): string {
  let d = '';
  const centres: [number, number, number][] = [
    [120, 160, 1],
    [330, 470, 1.15],
    [60, 600, 0.8],
  ];
  for (const [cx, cy, s] of centres) {
    for (let r = 18; r < 340; r += 17) {
      let p = '';
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        const w = 1 + 0.16 * Math.sin(3 * t + r / 40) + 0.1 * Math.sin(5 * t - r / 55) + 0.06 * Math.cos(2 * t + cx);
        p += `${a ? 'L' : 'M'}${(cx + Math.cos(t) * r * s * w).toFixed(1)} ${(cy + Math.sin(t) * r * s * w).toFixed(1)}`;
      }
      d += `<path d="${p}Z"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 700" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1.2">${d}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

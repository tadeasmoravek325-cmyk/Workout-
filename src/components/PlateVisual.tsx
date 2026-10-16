const PLATE_COLORS: Record<string, string> = {
  '25': '#e63946',
  '20': '#1d70d6',
  '15': '#f1c40f',
  '10': '#2ecc71',
  '5': '#eef1f6',
  '2.5': '#e63946',
  '1.25': '#9aa3b2',
  '0.5': '#9aa3b2',
};

export function PlateVisual({ plates }: { plates: number[] }) {
  const h = (p: number) => Math.max(36, Math.min(130, 40 + p * 3.6));
  return (
    <div className="plate-vis">
      <div className="bar" style={{ width: 40 }} />
      {plates.map((p, i) => (
        <div
          key={i}
          className="plate"
          style={{
            height: h(p),
            width: p >= 10 ? 22 : 16,
            background: PLATE_COLORS[String(p)] ?? '#6b7280',
            color: p === 5 ? '#111' : '#fff',
          }}
        >
          {String(p).replace('.', ',')}
        </div>
      ))}
      <div className="bar" style={{ width: 24, height: 18 }} />
    </div>
  );
}


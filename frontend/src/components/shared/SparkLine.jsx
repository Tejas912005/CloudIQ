export default function SparkLine({
  data = [],
  width = 60,
  height = 20,
  color = 'var(--accent)',
  filled = true,
}) {
  if (!data || data.length < 2) return null;

  const nums = data.map(Number).filter(n => !isNaN(n));
  if (nums.length < 2) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;

  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;

  // Map data points to SVG coordinates
  const points = nums.map((v, i) => ({
    x: pad + (i / (nums.length - 1)) * w,
    y: pad + h - ((v - min) / range) * h,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

  const fillPath = filled
    ? `${linePath} L${points[points.length - 1].x.toFixed(2)},${(pad + h).toFixed(2)} L${pad},${(pad + h).toFixed(2)} Z`
    : null;

  const gradId = `spark-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {filled && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && fillPath && (
        <path d={fillPath} fill={`url(#${gradId})`} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

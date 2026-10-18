/** Tiny inline trend line; values are real data. */
export function Sparkline({
  values,
  className,
  stroke = "currentColor",
  height = 28,
  width = 96,
}: {
  values: readonly number[];
  className?: string;
  stroke?: string;
  height?: number;
  width?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)} ${(2 + (1 - (v - min) / span) * (height - 4)).toFixed(1)}`,
    )
    .join(" ");
  const last = values.at(-1)!;
  return (
    <svg aria-hidden viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={2 + (1 - (last - min) / span) * (height - 4)} r={2.5} fill={stroke} />
    </svg>
  );
}

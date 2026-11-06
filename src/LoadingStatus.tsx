export function LoadingStatus({
  progress,
  label = "Loading model",
  indeterminate = true,
}: {
  label?: string;
  indeterminate?: boolean;
  progress?: { value: number; message: string };
}) {
  const value = Math.max(0, Math.min(1, progress?.value ?? 0));
  return (
    <svg
      className={`model-progress${value === 0 && indeterminate ? " indeterminate" : ""}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={
        value > 0 || !indeterminate ? Math.round(value * 100) : undefined
      }
    >
      <title>{`${label}: ${Math.round(value * 100)}%`}</title>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={
          100 - (value > 0 ? value * 100 : indeterminate ? 25 : 0)
        }
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

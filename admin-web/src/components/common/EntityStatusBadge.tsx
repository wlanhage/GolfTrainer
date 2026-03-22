export function EntityStatusBadge({ label, tone }: { label: string; tone: 'green' | 'yellow' | 'red' | 'blue' }) {
  return <span className={`status-badge ${tone}`}>{label}</span>;
}

export default function GlassPanel({ children, className = '' }) {
  return <section className={`glass-panel ${className}`.trim()}>{children}</section>;
}

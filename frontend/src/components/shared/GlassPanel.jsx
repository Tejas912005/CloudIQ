export default function GlassPanel({
  children,
  className = '',
  glow = false,
  style = {},
  ...props
}) {
  const boxShadow = glow
    ? [style.boxShadow, '0 0 40px var(--accent-glow)'].filter(Boolean).join(', ')
    : style.boxShadow;

  return (
    <section
      className={`glass-panel ${className}`.trim()}
      style={{ borderRadius: '14px', ...style, ...(boxShadow ? { boxShadow } : {}) }}
      {...props}
    >
      {children}
    </section>
  );
}

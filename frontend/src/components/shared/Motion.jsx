import { motion as Motion } from 'framer-motion';

/* 1. FadeUp — fades and rises with spring bounce */
export function FadeUp({ children, delay = 0, className, style, ...props }) {
  return (
    <Motion.div
      className={className}
      style={style}
      {...props}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 28,
        delay,
      }}
    >
      {children}
    </Motion.div>
  );
}

/* 2. StaggerParent — orchestrates children to appear sequentially */
export function StaggerParent({ children, className, style, staggerDelay = 0.07, ...props }) {
  return (
    <Motion.div
      className={className}
      style={style}
      {...props}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </Motion.div>
  );
}

/* 3. StaggerChild — used inside StaggerParent */
export function StaggerChild({ children, className, style, ...props }) {
  return (
    <Motion.div
      className={className}
      style={style}
      {...props}
      variants={{
        hidden: { opacity: 0, y: 18, scale: 0.97 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 380,
            damping: 26,
          },
        },
      }}
    >
      {children}
    </Motion.div>
  );
}

/* 4. SpringNumber — wraps AnimatedNumber with spring motion blur effect */
/* Used on the What-If Simulator and metric cards when values change */
export function SpringNumber({ value, children, className, style, ...props }) {
  return (
    <Motion.span
      key={String(value)}
      className={className}
      style={style}
      {...props}
      initial={{ opacity: 0.4, filter: 'blur(6px)', color: 'var(--data)' }}
      animate={{ opacity: 1, filter: 'blur(0px)', color: 'inherit' }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </Motion.span>
  );
}

/* 5. PressButton — gives physical press feedback on any button */
export function PressButton({
  children,
  className,
  style,
  onClick,
  type = 'button',
  title,
  disabled = false,
  ...props
}) {
  return (
    <Motion.button
      type={type}
      className={className}
      style={style}
      onClick={onClick}
      title={title}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97, y: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      {...props}
    >
      {children}
    </Motion.button>
  );
}

/* 6. SlideInLeft — slides in from left, for sidebar and panels */
export function SlideInLeft({ children, delay = 0, className, style, ...props }) {
  return (
    <Motion.div
      className={className}
      style={style}
      {...props}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 30,
        delay,
      }}
    >
      {children}
    </Motion.div>
  );
}

/* 7. ScaleFade — scales up from 95% with fade, for modals and popovers */
export function ScaleFade({ children, className, style, ...props }) {
  return (
    <Motion.div
      className={className}
      style={style}
      {...props}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {children}
    </Motion.div>
  );
}

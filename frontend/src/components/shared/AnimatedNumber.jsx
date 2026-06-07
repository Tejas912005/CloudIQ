import { useEffect, useRef } from 'react';
import { motion as Motion, useSpring, useTransform } from 'framer-motion';

export default function AnimatedNumber({ value, prefix = '', suffix = '' }) {
  const numericValue = typeof value === 'string'
    ? parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0
    : (Number(value) || 0);

  const prevValue = useRef(0);
  const spring = useSpring(0, { stiffness: 180, damping: 18, mass: 0.8 });

  const display = useTransform(spring, (current) => {
    const hasDecimals = numericValue % 1 !== 0;
    const formatted = hasDecimals ? current.toFixed(2) : Math.round(current).toLocaleString('en-US');
    const withCommas = hasDecimals
      ? formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      : formatted;
    return `${prefix}${withCommas}${suffix}`;
  });

  useEffect(() => {
    if (prevValue.current !== numericValue) {
      spring.set(numericValue);
      prevValue.current = numericValue;
    }
  }, [numericValue, spring]);

  return (
    <Motion.span
      key={numericValue}
      initial={{ color: 'var(--data)', filter: 'blur(2px)' }}
      animate={{ color: 'inherit', filter: 'blur(0px)' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{ fontFamily: 'inherit', display: 'inline-block' }}
    >
      {display}
    </Motion.span>
  );
}

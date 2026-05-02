import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export default function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1.2 }) {
  const numericValue = typeof value === 'string'
    ? parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0
    : (Number(value) || 0);

  const prevValue = useRef(0);
  const spring = useSpring(0, { bounce: 0, duration: duration * 1000 });

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

  return <motion.span style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{display}</motion.span>;
}

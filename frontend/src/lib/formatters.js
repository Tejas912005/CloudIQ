export function formatCurrency(
  value,
  { minimumFractionDigits = 2, maximumFractionDigits = 2, fallback = '$0.00' } = {}
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

export function formatTrendLabel(direction) {
  if (direction === 'increasing') {
    return 'Rising';
  }

  if (direction === 'decreasing') {
    return 'Falling';
  }

  return 'Stable';
}

export function formatPercent(value, fallback = '--') {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  return `${Math.round(amount)}%`;
}

export function formatCompactNumber(value, fallback = '--') {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return fallback;
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatClock(dateLike) {
  if (!dateLike) {
    return '--:--';
  }

  const value = new Date(dateLike);

  if (Number.isNaN(value.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function formatRelativeMinutes(dateLike) {
  if (!dateLike) {
    return 'just now';
  }

  const value = new Date(dateLike);

  if (Number.isNaN(value.getTime())) {
    return 'just now';
  }

  const deltaMinutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60000));

  if (deltaMinutes < 1) {
    return 'just now';
  }

  if (deltaMinutes === 1) {
    return '1 min ago';
  }

  return `${deltaMinutes} mins ago`;
}

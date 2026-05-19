// Centraliserad datumformatering. Alla användarvänliga datum/tider i webbapp:en
// går genom dessa helpers så vi får konsekvent sv-SE-formatering.

const LOCALE = 'sv-SE';

export const formatDate = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(LOCALE);
};

export const formatDateTime = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const formatRelative = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  const diffMs = Date.now() - d.getTime();

  if (diffMs < MINUTE) return 'nyss';
  if (diffMs < HOUR) {
    const m = Math.floor(diffMs / MINUTE);
    return `för ${m} min sen`;
  }
  if (diffMs < DAY) {
    const h = Math.floor(diffMs / HOUR);
    return `för ${h} ${h === 1 ? 'timme' : 'timmar'} sen`;
  }
  if (diffMs < 2 * DAY) return 'igår';
  if (diffMs < WEEK) {
    const days = Math.floor(diffMs / DAY);
    return `för ${days} dagar sen`;
  }
  return formatDate(d);
};

export const formatRelativeShort = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / DAY);
  if (days === 0) return 'idag';
  if (days === 1) return 'igår';
  if (days < 7) return `för ${days} dagar sen`;
  return formatDate(d);
};

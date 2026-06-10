import { useState } from 'react';

// Federal fiscal year: Oct 1 – Sep 30
// FY2026 = Oct 1, 2025 – Sep 30, 2026
export function getFYDateRange(fyString) {
  // fyString like "FY2026" or "2026"
  const yr = parseInt(String(fyString).replace('FY', ''), 10);
  if (isNaN(yr)) return { start: null, end: null };
  return {
    start: `${yr - 1}-10-01`,
    end: `${yr}-09-30`,
  };
}

// Check if an application falls within a given FY
// Uses performance_start, performance_end, or created_date
export function appMatchesFY(app, fyString) {
  if (!fyString || fyString === 'All') return true;
  const { start, end } = getFYDateRange(fyString);
  if (!start) return true;
  const appDate = app.performance_start || app.performance_end || app.created_date || '';
  if (!appDate) return false;
  return appDate >= start && appDate <= end;
}

// Generate FY options from app data (derives from performance_start dates)
export function deriveFYOptions(apps) {
  const years = new Set();
  apps.forEach(a => {
    ['performance_start', 'performance_end', 'created_date'].forEach(field => {
      const val = a[field];
      if (val) {
        const yr = parseInt(val.slice(0, 4), 10);
        if (yr >= 2020 && yr <= 2040) {
          // Determine which FY this date belongs to
          const month = parseInt(val.slice(5, 7), 10);
          const fy = month >= 10 ? yr + 1 : yr; // Oct+ is next FY
          years.add(fy);
        }
      }
    });
  });
  const now = new Date();
  const currentFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  years.add(currentFY);
  years.add(currentFY + 1);
  return ['All', ...[...years].sort((a, b) => b - a).map(y => `FY${y}`)];
}

export function useDateRangeFilter() {
  const [dateMode, setDateMode] = useState('none'); // 'none', 'fiscal', 'custom'
  const now = new Date();
  const defaultFY = `FY${now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear()}`;
  const [fiscalYear, setFiscalYear] = useState(defaultFY);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const getEffectiveDateRange = () => {
    if (dateMode === 'fiscal') {
      return getFYDateRange(fiscalYear);
    } else if (dateMode === 'custom') {
      return { start: dateStart, end: dateEnd };
    }
    return { start: null, end: null };
  };

  const reset = () => {
    setDateMode('none');
    setDateStart('');
    setDateEnd('');
  };

  // Generate FY year options for the dropdown (current + past 5 years)
  const fyYearOptions = Array.from({ length: 6 }, (_, i) => {
    const yr = (now.getMonth() >= 9 ? now.getFullYear() + 2 : now.getFullYear() + 1) - i;
    return `FY${yr}`;
  });

  return {
    dateMode,
    setDateMode,
    fiscalYear,
    setFiscalYear,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    getEffectiveDateRange,
    reset,
    fyYearOptions,
  };
}

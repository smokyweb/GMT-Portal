import { useState } from 'react';

export function useDateRangeFilter() {
  const [dateMode, setDateMode] = useState('none'); // 'none', 'fiscal', 'custom'
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const getEffectiveDateRange = () => {
    if (dateMode === 'fiscal') {
      const fy = parseInt(fiscalYear);
      return { start: `${fy}-10-01`, end: `${fy + 1}-09-30` };
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
  };
}
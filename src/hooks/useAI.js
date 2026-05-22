import { useState, useCallback, useEffect, useMemo } from 'react';
import { getRealtimeAdvice, generateReport } from '../utils/aiRules';

export function useAI(results, currentPeriod) {
  const [report, setReport] = useState(null);

  // 財務データ(results)が変更されたらリアルタイムアラートを計算
  const warnings = useMemo(() => {
    if (!results) return [];
    return getRealtimeAdvice(results);
  }, [results]);

  const handleGenerateReport = useCallback(() => {
    if (!results) return;
    const reportText = generateReport(results, currentPeriod);
    setReport(reportText);
  }, [results, currentPeriod]);

  return {
    warnings,
    report,
    generateReport: handleGenerateReport
  };
}

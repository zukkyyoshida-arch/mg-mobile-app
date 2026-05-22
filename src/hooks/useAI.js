import { useState, useCallback, useEffect } from 'react';
import { getRealtimeAdvice, generateReport } from '../utils/aiRules';

export function useAI(results, currentPeriod) {
  const [warnings, setWarnings] = useState([]);
  const [report, setReport] = useState(null);

  // 財務データ(results)が変更されたら常にリアルタイムアラートを更新する
  useEffect(() => {
    if (results) {
      const newWarnings = getRealtimeAdvice(results);
      setWarnings(newWarnings);
    }
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

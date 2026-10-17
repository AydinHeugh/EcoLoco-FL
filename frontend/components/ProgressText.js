import { useEffect, useState } from 'react';

const STEPS = ['Identifying…', 'Checking Florida lists…'];

export function useProgressText(active) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    if (!active) return undefined;
    const timer = setTimeout(() => setStep(1), 2000);
    return () => clearTimeout(timer);
  }, [active]);
  return STEPS[step];
}

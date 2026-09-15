import { useEffect, useState } from 'react';

export const PHONE_MQ = '(max-width: 767px)';

export function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(PHONE_MQ).matches;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ);
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}

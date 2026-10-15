import { useEffect, useState } from "react";
// One wall-clock snapshot per render; resync on focus after background tabs throttle timers.
export function useClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return now;
}

import React, { useEffect, useState, useRef } from "react";

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [updating, setUpdating] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    const startTime = performance.now();
    let frame;
    let resetTimer;
    setUpdating(true);

    function animate(now) {
      const progress = Math.min(1, (now - startTime) / 650);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
        resetTimer = window.setTimeout(() => setUpdating(false), 350);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(resetTimer);
    };
  }, [value]);

  return <span className={`animated-number ${updating ? "updating" : ""}`}>{displayValue.toLocaleString("ru-RU")}</span>;
}

export default AnimatedNumber;

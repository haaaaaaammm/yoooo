"use client";

import React, { useEffect, useMemo, useState } from "react";


// --- CONFIG ---------------------------------------------------------------
const BIRTH_ISO = "2001-11-08T00:55:00-06:00"; // 8 Nov 2001, 12:55 AM CST
const LIFE_EXPECTANCY_YEARS = 80;

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function msToDHMS(ms: number) {
  if (ms < 0) ms = 0;
  const days = Math.floor(ms / MS_PER_DAY);
  ms -= days * MS_PER_DAY;
  const hours = Math.floor(ms / MS_PER_HOUR);
  ms -= hours * MS_PER_HOUR;
  const minutes = Math.floor(ms / MS_PER_MIN);
  ms -= minutes * MS_PER_MIN;
  const seconds = Math.floor(ms / 1000);
  return { days, hours, minutes, seconds };
}

export default function DeathClock () {
  const birth = useMemo(() => new Date(BIRTH_ISO), []);
  const death = useMemo(
    () => new Date(birth.getTime() + LIFE_EXPECTANCY_YEARS * MS_PER_YEAR),
    [birth]
  );

  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(death.getTime() - now.getTime(), 0);
  const { days, hours, minutes, seconds } = msToDHMS(remainingMs);

  return (
    <div className="min-h-dvh bg-white flex items-center justify-center">
      <div className="text-center red ">
        <div
          className="leading-none seg tracking-tight "
          style={{
            fontSize: "clamp(25px, 6vw, 50px)",
          }}
        >
          {days}:{pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </div>
      </div>
    </div>
  );
}

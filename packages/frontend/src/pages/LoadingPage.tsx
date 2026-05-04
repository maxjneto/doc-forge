import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./LoadingPage.css";

const SPARK_TTL_MS = 1500;
const BASELINE_SPARK_INTERVAL_MS = 700;
const INITIAL_BURST_COUNT = 10;
const HIT_BURST_COUNT = 8;

const TEXTURE_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuADM6bvc0z51p1Oa_7DHp3rB79ypnGy_3bEB7ESLkzy30KRmsr7kwWFdM9pzIinNIPuYyqDGuXaDM4WsyautnpfX5XMz8L3eCrmarfHO9SK_vFn96fkC-VLoBfUqSDqqpAyQz8bUPqoerbOZZL0qLK4znNWzptId4ohcoi71QYwEBgvXB5Zusz7rtuHp3Xo2kNXrREdWFwQU7wt2bikUfHewJnBnHf5KZrnrTzboJYO-qzzaT5BuKMnhENpzOtotnpA-DX7xRjPmIl9";

type SparkParticle = {
  id: number;
  size: number;
  tx: number;
  ty: number;
};

type SparkStyle = CSSProperties & {
  "--spark-tx": string;
  "--spark-ty": string;
};

function makeSpark(id: number): SparkParticle {
  const angle = Math.random() * Math.PI * 2;
  const distance = 80 + Math.random() * 120;

  return {
    id,
    size: Math.random() * 3 + 1,
    tx: Math.cos(angle) * distance,
    ty: Math.sin(angle) * distance,
  };
}

export function LoadingPage() {
  const [sparks, setSparks] = useState<SparkParticle[]>([]);
  const hitGlowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let sparkCounter = 0;
    const burstTimerIds: number[] = [];

    const spawnSpark = () => {
      sparkCounter += 1;
      const spark = makeSpark(sparkCounter);

      setSparks((prev) => [...prev, spark]);

      window.setTimeout(() => {
        setSparks((prev) => prev.filter((item) => item.id !== spark.id));
      }, SPARK_TTL_MS);
    };

    const spawnSparkBurst = (count: number, spreadMs: number) => {
      for (let idx = 0; idx < count; idx += 1) {
        const timerId = window.setTimeout(spawnSpark, idx * spreadMs);
        burstTimerIds.push(timerId);
      }
    };

    const baselineSparkIntervalId = window.setInterval(spawnSpark, BASELINE_SPARK_INTERVAL_MS);
    const handleHitCycle = () => {
      spawnSparkBurst(HIT_BURST_COUNT, 45);
    };

    const glowEl = hitGlowRef.current;
    if (glowEl) {
      glowEl.addEventListener("animationiteration", handleHitCycle);
    }

    const initialHitTimerId = window.setTimeout(handleHitCycle, 0);
    burstTimerIds.push(initialHitTimerId);

    spawnSparkBurst(INITIAL_BURST_COUNT, 50);

    return () => {
      window.clearInterval(baselineSparkIntervalId);
      if (glowEl) {
        glowEl.removeEventListener("animationiteration", handleHitCycle);
      }
      burstTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  return (
    <div className="loading-canvas fixed inset-0 overflow-hidden bg-background text-on-surface">
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.05]" aria-hidden="true">
        <img
          className="h-full w-full object-cover grayscale"
          src={TEXTURE_IMAGE_URL}
          alt=""
        />
      </div>

      <main className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6">
        <div className="relative mb-2 flex h-96 w-96 items-center justify-center" id="forge-core">
          <div className="pulse-slow absolute h-64 w-64 rounded-full border border-primary-container/10 bg-primary-container/5" />
          <div className="forge-hit-wave absolute h-64 w-64 rounded-full border border-primary-container/35" />
          <div
            ref={hitGlowRef}
            className="forge-hit-glow absolute h-16 w-16 rounded-full bg-primary-container/10"
          />
          <div className="forge-hit-core relative z-10 h-8 w-8 rounded-full bg-primary-container shadow-[0_0_32px_rgba(255,77,0,0.85)]" />

          {sparks.map((spark) => {
            const style: SparkStyle = {
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              "--spark-tx": `${spark.tx}px`,
              "--spark-ty": `${spark.ty}px`,
            };

            return <span key={spark.id} className="forge-spark" style={style} />;
          })}
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-on-surface/80">
            Initializing The Forge...
          </span>

          <div className="relative mt-1 h-px w-16 overflow-hidden bg-outline-variant/30">
            <div className="forge-progress absolute inset-0 w-1/2 bg-primary-container" />
          </div>
        </div>

        <p className="absolute bottom-10 text-[11px] text-on-surface-variant/40">
          Workspace v4.0.12
        </p>
      </main>
    </div>
  );
}

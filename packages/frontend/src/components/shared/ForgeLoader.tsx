import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../pages/LoadingPage.css";

const SPARK_TTL_MS = 1500;
const BASELINE_SPARK_INTERVAL_MS = 700;
const INITIAL_BURST_COUNT = 10;
const HIT_BURST_COUNT = 8;

type SparkParticle = { id: number; size: number; tx: number; ty: number };
type SparkStyle = CSSProperties & { "--spark-tx": string; "--spark-ty": string };

function makeSpark(id: number): SparkParticle {
  const angle = Math.random() * Math.PI * 2;
  const distance = 40 + Math.random() * 60;
  return {
    id,
    size: Math.random() * 3 + 1,
    tx: Math.cos(angle) * distance,
    ty: Math.sin(angle) * distance,
  };
}

export interface ForgeLoaderStep {
  message: string;
  detail: string;
}

interface ForgeLoaderProps {
  steps: ForgeLoaderStep[];
  stepInterval?: number;
}

export function ForgeLoader({ steps, stepInterval = 3000 }: ForgeLoaderProps) {
  const [sparks, setSparks] = useState<SparkParticle[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const hitGlowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, stepInterval);
    return () => clearInterval(interval);
  }, [steps.length, stepInterval]);

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
    const handleHitCycle = () => spawnSparkBurst(HIT_BURST_COUNT, 45);

    const glowEl = hitGlowRef.current;
    if (glowEl) glowEl.addEventListener("animationiteration", handleHitCycle);

    const initialHitTimerId = window.setTimeout(handleHitCycle, 0);
    burstTimerIds.push(initialHitTimerId);
    spawnSparkBurst(INITIAL_BURST_COUNT, 50);

    return () => {
      window.clearInterval(baselineSparkIntervalId);
      if (glowEl) glowEl.removeEventListener("animationiteration", handleHitCycle);
      burstTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const current = steps[stepIndex];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-48 w-48 items-center justify-center">
        <div className="pulse-slow absolute h-32 w-32 rounded-full border border-primary-container/10 bg-primary-container/5" />
        <div className="forge-hit-wave absolute h-32 w-32 rounded-full border border-primary-container/35" />
        <div
          ref={hitGlowRef}
          className="forge-hit-glow absolute h-8 w-8 rounded-full bg-primary-container/10"
        />
        <div className="forge-hit-core relative z-10 h-4 w-4 rounded-full bg-primary-container shadow-[0_0_24px_rgba(255,77,0,0.85)]" />

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

      <div className="text-center min-h-[3rem]">
        <p key={stepIndex} className="text-sm text-on-surface font-medium animate-fade-in">
          {current.message}
        </p>
        <p
          key={`detail-${stepIndex}`}
          className="text-xs text-on-surface-variant/50 mt-1 animate-fade-in"
        >
          {current.detail}
        </p>
      </div>

      <div className="relative h-px w-16 overflow-hidden bg-outline-variant/30">
        <div className="forge-progress absolute inset-0 w-1/2 bg-primary-container" />
      </div>

      <div className="flex gap-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i <= stepIndex ? "bg-primary-container" : "bg-surface-container-high"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

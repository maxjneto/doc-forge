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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {/* Orb */}
      <div
        style={{
          position: "relative",
          display: "flex",
          height: 192,
          width: 192,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Outer pulse ring */}
        <div
          className="pulse-slow"
          style={{
            position: "absolute",
            height: 128,
            width: 128,
            borderRadius: "50%",
            border: "1px solid rgba(255,77,0,0.10)",
            background: "rgba(255,77,0,0.05)",
          }}
        />
        {/* Hit wave ring */}
        <div
          className="forge-hit-wave"
          style={{
            position: "absolute",
            height: 128,
            width: 128,
            borderRadius: "50%",
            border: "1px solid rgba(255,77,0,0.35)",
          }}
        />
        {/* Hit glow */}
        <div
          ref={hitGlowRef}
          className="forge-hit-glow"
          style={{
            position: "absolute",
            height: 32,
            width: 32,
            borderRadius: "50%",
            background: "rgba(255,77,0,0.10)",
          }}
        />
        {/* Core */}
        <div
          className="forge-hit-core"
          style={{
            position: "relative",
            zIndex: 10,
            height: 16,
            width: 16,
            borderRadius: "50%",
            background: "var(--df-amber-500, #ff4d00)",
            boxShadow: "0 0 24px rgba(255,77,0,0.85), 0 0 0 3px rgba(255,77,0,0.15)",
          }}
        />

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

      {/* Step text */}
      <div style={{ textAlign: "center", minHeight: 48 }}>
        <p
          key={stepIndex}
          className="animate-fade-in"
          style={{ fontSize: 13, color: "#e3e2e2", fontWeight: 500, margin: "0 0 4px" }}
        >
          {current.message}
        </p>
        <p
          key={`detail-${stepIndex}`}
          className="animate-fade-in"
          style={{ fontSize: 11, color: "var(--df-faint, rgba(227,226,226,0.38))", margin: 0 }}
        >
          {current.detail}
        </p>
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "relative",
          height: 1,
          width: 64,
          overflow: "hidden",
          background: "var(--df-outline, rgba(255,255,255,0.06))",
          borderRadius: 1,
        }}
      >
        <div
          className="forge-progress"
          style={{
            position: "absolute",
            inset: 0,
            width: "50%",
            background: "var(--df-amber-500, #ff4d00)",
          }}
        />
      </div>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              transition: "background 0.3s",
              background: i <= stepIndex
                ? "var(--df-amber-500, #ff4d00)"
                : "var(--df-mute, rgba(227,226,226,0.18))",
              boxShadow: i === stepIndex ? "0 0 6px rgba(255,77,0,0.6)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./LoadingPage.css";

const SPARK_TTL_MS = 1500;
const BASELINE_SPARK_INTERVAL_MS = 700;
const INITIAL_BURST_COUNT = 10;
const HIT_BURST_COUNT = 8;

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "radial-gradient(circle at center, #1a1512 0%, #050608 100%)",
        color: "#e3e2e2",
      }}
    >
      {/* Ambient radial */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 600px 400px at 50% 40%, rgba(255,77,0,0.06), transparent 65%)",
          zIndex: 0,
        }}
      />

      <main
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        {/* Orb */}
        <div
          id="forge-core"
          style={{
            position: "relative",
            marginBottom: 8,
            display: "flex",
            height: 384,
            width: 384,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Outer pulse ring */}
          <div
            className="pulse-slow"
            style={{
              position: "absolute",
              height: 256,
              width: 256,
              borderRadius: "50%",
              border: "1px solid rgba(255,77,0,0.10)",
              background: "rgba(255,77,0,0.05)",
            }}
          />
          {/* Hit wave */}
          <div
            className="forge-hit-wave"
            style={{
              position: "absolute",
              height: 256,
              width: 256,
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
              height: 64,
              width: 64,
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
              height: 32,
              width: 32,
              borderRadius: "50%",
              background: "#ff4d00",
              boxShadow: "0 0 32px rgba(255,77,0,0.85), 0 0 0 4px rgba(255,77,0,0.15)",
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

        {/* Label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span
            className="df-mono"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "rgba(227,226,226,0.80)",
            }}
          >
            Initializing The Forge...
          </span>

          {/* Progress bar */}
          <div
            style={{
              position: "relative",
              marginTop: 4,
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
                background: "#ff4d00",
              }}
            />
          </div>
        </div>

        {/* Version footer */}
        <span
          className="df-mono"
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--df-mute, rgba(227,226,226,0.18))",
          }}
        >
          Workspace v4.0.12
        </span>
      </main>
    </div>
  );
}

import type { Phase } from "@/types";
import type { ReactNode } from "react";

interface PhaseTransitionProps {
  phase: Phase;
  children: ReactNode;
}

export function PhaseTransition({ children }: PhaseTransitionProps) {
  return (
    <div className="animate-fade-in h-full w-full">
      {children}
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import type { Phase } from "@/types";

interface TopBarProps {
  phase?: Phase;
  phaseLabel?: string;
  credits?: number;
}

export function TopBar({ phaseLabel, credits }: TopBarProps) {
  const { pathname } = useLocation();
  const isHome = pathname === "/home";
  const isDocument = pathname.startsWith("/document/");

  return (
    <header className="fixed top-2 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-7xl h-[48px] z-50 backdrop-blur-md bg-surface/70 rounded-full panel-depth flex items-center justify-between px-6 atmospheric-shadow">
      {/* Left: brand */}
      <Link
        to="/home"
        className="text-sm font-bold tracking-tighter text-on-surface opacity-90 hover:opacity-100 transition-opacity"
      >
        DOCFORGE
      </Link>

      {/* Center: nav */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
        <Link
          to="/home"
          className={`text-xs uppercase tracking-wider font-semibold px-3 py-1 transition-colors ${
            isHome
              ? "text-primary-container"
              : "text-on-surface-variant/50 hover:text-on-surface"
          }`}
        >
          Home
        </Link>
        {isDocument ? (
          <Link
            to={pathname}
            className="text-xs uppercase tracking-wider font-semibold px-3 py-1 text-primary-container"
          >
            Document
          </Link>
        ) : (
          <span className="text-xs uppercase tracking-wider font-semibold px-3 py-1 text-on-surface-variant/25 cursor-default select-none">
            Document
          </span>
        )}
      </nav>

      {/* Right: credits + phase label + user */}
      <div className="flex items-center gap-4">
        {credits !== undefined && (
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              credits > 0 ? "text-primary-container" : "text-on-surface-variant/40"
            }`}
            title="Weekly credits remaining"
          >
            {credits} cr
          </span>
        )}
        {phaseLabel && (
          <span className="text-xs uppercase tracking-wider text-on-surface-variant/60 font-medium">
            PHASE: {phaseLabel}
          </span>
        )}
        <UserButton />
      </div>
    </header>
  );
}

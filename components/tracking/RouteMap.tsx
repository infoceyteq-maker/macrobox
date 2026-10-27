"use client";

import { motion } from "framer-motion";
import { cn, NEU } from "@/components/ui/neu";

interface RouteMapProps {
  progress: number;
  label: string;
  sublabel: string;
  badge?: string;
  footer?: string;
  compact?: boolean;
}

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function quadraticPoint(t: number) {
  const p0 = { x: 24, y: 104 };
  const p1 = { x: 120, y: 12 };
  const p2 = { x: 286, y: 58 };
  const inverse = 1 - t;
  return {
    x: inverse * inverse * p0.x + 2 * inverse * t * p1.x + t * t * p2.x,
    y: inverse * inverse * p0.y + 2 * inverse * t * p1.y + t * t * p2.y,
  };
}

/** Stylised map placeholder. No real GPS or Google Maps API key is claimed. */
export default function RouteMap({
  progress,
  label,
  sublabel,
  badge = "Simulated live location",
  footer,
  compact = false,
}: RouteMapProps) {
  const value = clampProgress(progress);
  const point = quadraticPoint(value);

  return (
    <div className={cn(NEU.card, compact ? "p-4" : "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold">{label}</p>
          <p className="mt-1 text-xs text-[#6f7a74]">{sublabel}</p>
        </div>
        <span className={cn(NEU.badge, "!text-[10px] uppercase tracking-widest")}>{badge}</span>
      </div>

      <div
        className={cn(
          NEU.inset,
          "relative mt-4 overflow-hidden",
          compact ? "h-[150px]" : "h-[210px]",
        )}
      >
        <svg viewBox="0 0 310 130" className="h-full w-full" role="img" aria-label="Simulated delivery route">
          <defs>
            <pattern id="macrobox-grid" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#bccbb8" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width="310" height="130" fill="url(#macrobox-grid)" />
          <path
            d="M24 104 Q120 12 286 58"
            fill="none"
            stroke="#9fb19b"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.45"
          />
          <path
            d="M24 104 Q120 12 286 58"
            fill="none"
            stroke="#7CA982"
            strokeWidth="3"
            strokeDasharray="7 7"
            strokeLinecap="round"
          />
          <circle cx="24" cy="104" r="8" fill="#F7F6F2" stroke="#7CA982" strokeWidth="3" />
          <circle cx="286" cy="58" r="8" fill="#8FBC8F" stroke="#3f6b45" strokeWidth="3" />
          <motion.g animate={{ x: point.x, y: point.y }} transition={{ type: "spring", stiffness: 90, damping: 18 }}>
            <circle r="11" fill="#8FBC8F" stroke="#F7F6F2" strokeWidth="3" />
            <circle r="3.5" fill="#22301f" />
          </motion.g>
          <text x="14" y="124" fontSize="9" fill="#5f6d64">
            Kitchen
          </text>
          <text x="266" y="44" fontSize="9" fill="#3f6b45">
            Customer
          </text>
        </svg>
      </div>

      {footer ? <p className="mt-3 text-xs leading-5 text-[#6f7a74]">{footer}</p> : null}
    </div>
  );
}

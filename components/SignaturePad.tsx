"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const canvasClass =
  "h-[120px] w-full touch-none rounded-2xl bg-white shadow-[inset_6px_6px_12px_#d3d9d0,inset_-6px_-6px_12px_#ffffff]";

export default function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2E3033";

    if (value.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
      setHasInk(true);
    } else {
      setHasInk(false);
    }
  }, [value]);

  function context() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx } : null;
  }

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const active = context();
    if (!active) return;
    drawingRef.current = true;
    active.canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    active.ctx.beginPath();
    active.ctx.moveTo(p.x, p.y);
    active.ctx.lineTo(p.x + 0.1, p.y + 0.1);
    active.ctx.stroke();
    setHasInk(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const active = context();
    if (!active) return;
    const p = point(event);
    active.ctx.lineTo(p.x, p.y);
    active.ctx.stroke();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const active = context();
    if (!active) return;
    try {
      active.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    onChange(active.canvas.toDataURL("image/png"));
  }

  function clear() {
    const active = context();
    if (!active) return;
    active.ctx.fillStyle = "#ffffff";
    active.ctx.fillRect(0, 0, active.canvas.width, active.canvas.height);
    active.ctx.lineWidth = 2.5;
    active.ctx.lineCap = "round";
    active.ctx.lineJoin = "round";
    active.ctx.strokeStyle = "#2E3033";
    setHasInk(false);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
          Customer e-signature
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="text-xs font-semibold text-[#6f7a74] underline-offset-2 hover:underline disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={240}
        className={canvasClass}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-label="Draw customer signature"
      />
      {value.startsWith("data:image/") ? (
        <p className="text-xs font-medium text-[#3f6b45]">Signature captured.</p>
      ) : value ? (
        <p className="break-all text-xs text-[#6f7a74]">
          Existing reference: <span className="font-mono">{value}</span>
        </p>
      ) : (
        <p className="text-xs text-[#7b857f]">
          Draw with a mouse, trackpad, or touch. The image is stored with the delivery evidence.
        </p>
      )}
    </div>
  );
}

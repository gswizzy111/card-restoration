"use client";

import { useRef, useEffect, useState } from "react";

interface SignaturePadProps {
  onSign: (dataUrl: string) => void;
  onClear: () => void;
}

export function SignaturePad({ onSign, onClear }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
  }, []);

  function getXY(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width / dpr),
      y: (e.clientY - rect.top) * (canvas.height / rect.height / dpr),
    };
  }

  function startStroke(x: number, y: number) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }

  function continueStroke(x: number, y: number) {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endStroke() {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasSigned(true);
    onSign(canvasRef.current!.toDataURL("image/png"));
  }

  // Mouse handlers
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getXY(e.nativeEvent);
    startStroke(x, y);
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDrawing) {
      const { x, y } = getXY(e.nativeEvent);
      continueStroke(x, y);
    }
  }

  // Touch handlers
  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const { x, y } = getXY(e.touches[0]);
    startStroke(x, y);
  }
  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (isDrawing) {
      const { x, y } = getXY(e.touches[0]);
      continueStroke(x, y);
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSigned(false);
    setIsDrawing(false);
    onClear();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative rounded-xl overflow-hidden transition-colors ${
          hasSigned
            ? "border-2 border-primary bg-white"
            : "border-2 border-dashed border-border bg-gray-50"
        }`}
        style={{ height: 130 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endStroke}
        />
        {/* Placeholder */}
        {!hasSigned && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-muted-foreground/40">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
            </svg>
            <span className="text-sm text-muted-foreground/60">Draw your signature here</span>
          </div>
        )}
        {/* Signature baseline */}
        <div className="absolute bottom-7 left-6 right-6 border-b border-gray-300 pointer-events-none" />
        <span className="absolute bottom-2 left-6 text-[10px] text-gray-400 pointer-events-none select-none">
          ✕ Sign above
        </span>
      </div>

      <div className="flex items-center justify-between min-h-[20px]">
        {hasSigned ? (
          <p className="text-xs text-primary font-medium">✓ Signature captured</p>
        ) : (
          <p className="text-xs text-muted-foreground">Use your mouse or finger to sign</p>
        )}
        {hasSigned && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear & redo
          </button>
        )}
      </div>
    </div>
  );
}

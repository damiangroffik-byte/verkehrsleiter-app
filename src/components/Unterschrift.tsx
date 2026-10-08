"use client";

import { useEffect, useRef, useState } from "react";

// Unterschrift mit Finger oder Maus. Meldet nach jedem Strich, ob etwas gezeichnet ist.
export function Unterschrift({ onChange }: { onChange: (canvas: HTMLCanvasElement | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const [leer, setLeer] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const verhaeltnis = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * verhaeltnis;
    canvas.height = canvas.offsetHeight * verhaeltnis;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(verhaeltnis, verhaeltnis);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1440";
  }, []);

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = punkt(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function bewegen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = punkt(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function ende() {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    setLeer(false);
    onChange(canvasRef.current);
  }

  function loeschen() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setLeer(true);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        aria-label="Unterschrift"
        onPointerDown={start}
        onPointerMove={bewegen}
        onPointerUp={ende}
        onPointerCancel={ende}
        className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-gray-400 bg-white"
      />
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{leer ? "Mit dem Finger unterschreiben" : "Unterschrieben"}</span>
        <button type="button" onClick={loeschen} className="h-11 px-3 underline">
          Löschen
        </button>
      </div>
    </div>
  );
}

// Unterschrift als PNG für den Upload.
export function alsPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((ok, fehler) =>
    canvas.toBlob((b) => (b ? ok(b) : fehler(new Error("Unterschrift leer"))), "image/png"),
  );
}

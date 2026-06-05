'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Object URL or http URL of the reference image to draw on. */
  imageUrl: string;
  /** Called whenever the mask changes; PNG blob is the mask in original-image pixel dimensions
      (white = repaint, black = keep). */
  onMaskChange?: (blob: Blob | null) => void;
  /** Max display width (px). The internal canvas keeps original pixel dimensions for accuracy. */
  maxDisplayWidth?: number;
}

export default function MaskCanvas({ imageUrl, onMaskChange, maxDisplayWidth = 768 }: Props) {
  const refCanvasRef = useRef<HTMLCanvasElement>(null);    // reference image (background)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);   // mask overlay (transparent + painted)
  const dispCanvasRef = useRef<HTMLCanvasElement>(null);   // visible composite for display

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const [brush, setBrush] = useState(40);
  const [eraser, setEraser] = useState(false);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load image, set canvas dimensions, paint reference
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setSize({ w, h });

      const scale = Math.min(1, maxDisplayWidth / w);
      setDisplaySize({ w: Math.round(w * scale), h: Math.round(h * scale) });

      const refCanvas = refCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const dispCanvas = dispCanvasRef.current;
      if (!refCanvas || !maskCanvas || !dispCanvas) return;

      refCanvas.width = w; refCanvas.height = h;
      maskCanvas.width = w; maskCanvas.height = h;
      dispCanvas.width = w; dispCanvas.height = h;

      const rctx = refCanvas.getContext('2d')!;
      rctx.drawImage(img, 0, 0, w, h);

      const mctx = maskCanvas.getContext('2d')!;
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, w, h);

      redrawDisplay();
      emitMask();  // initial empty mask
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, maxDisplayWidth]);

  const redrawDisplay = () => {
    const refCanvas = refCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const dispCanvas = dispCanvasRef.current;
    if (!refCanvas || !maskCanvas || !dispCanvas) return;
    const ctx = dispCanvas.getContext('2d')!;
    ctx.drawImage(refCanvas, 0, 0);
    // Tint the masked (white) region red 50% so user can see where they painted
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();
    // Overlay translucent red on white areas
    const maskCtx = maskCanvas.getContext('2d')!;
    const data = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const overlay = ctx.createImageData(data.width, data.height);
    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i] > 128) {
        overlay.data[i] = 255;     // red
        overlay.data[i + 1] = 60;
        overlay.data[i + 2] = 60;
        overlay.data[i + 3] = 110; // alpha
      }
    }
    // Draw overlay back onto display
    ctx.drawImage(refCanvas, 0, 0);
    const tmp = document.createElement('canvas');
    tmp.width = data.width; tmp.height = data.height;
    tmp.getContext('2d')!.putImageData(overlay, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  };

  const emitMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) { onMaskChange?.(null); return; }
    maskCanvas.toBlob((blob) => onMaskChange?.(blob), 'image/png');
  };

  const eventToCanvasCoord = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawCircle = (x: number, y: number) => {
    const maskCtx = maskCanvasRef.current?.getContext('2d');
    if (!maskCtx) return;
    const radiusOnCanvas = brush * (size?.w ?? 1024) / (displaySize?.w ?? 1024) / 2;
    maskCtx.fillStyle = eraser ? 'black' : 'white';
    maskCtx.beginPath();
    maskCtx.arc(x, y, radiusOnCanvas, 0, 2 * Math.PI);
    maskCtx.fill();
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const maskCtx = maskCanvasRef.current?.getContext('2d');
    if (!maskCtx) return;
    const widthOnCanvas = brush * (size?.w ?? 1024) / (displaySize?.w ?? 1024);
    maskCtx.strokeStyle = eraser ? 'black' : 'white';
    maskCtx.lineWidth = widthOnCanvas;
    maskCtx.lineCap = 'round';
    maskCtx.beginPath();
    maskCtx.moveTo(from.x, from.y);
    maskCtx.lineTo(to.x, to.y);
    maskCtx.stroke();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = eventToCanvasCoord(e);
    lastPosRef.current = p;
    drawCircle(p.x, p.y);
    redrawDisplay();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const p = eventToCanvasCoord(e);
    if (lastPosRef.current) drawLine(lastPosRef.current, p);
    lastPosRef.current = p;
    redrawDisplay();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPosRef.current = null;
    emitMask();
  };

  const clear = () => {
    const mctx = maskCanvasRef.current?.getContext('2d');
    if (!mctx || !maskCanvasRef.current) return;
    mctx.fillStyle = 'black';
    mctx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    redrawDisplay();
    emitMask();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setEraser(false)}
          className={`btn-secondary ${!eraser ? 'border-accent text-accent' : ''}`}
        >
          🖌️ 画笔
        </button>
        <button
          type="button"
          onClick={() => setEraser(true)}
          className={`btn-secondary ${eraser ? 'border-accent text-accent' : ''}`}
        >
          🧽 橡皮
        </button>
        <label className="flex items-center gap-2">
          <span className="text-fg-muted">粗细 {brush}</span>
          <input
            type="range"
            min={5}
            max={120}
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
        <button type="button" onClick={clear} className="btn-secondary">
          🗑️ 清空
        </button>
      </div>

      <div className="text-xs text-fg-subtle">
        在图上涂抹要 AI 重画的区域（红色部分会被替换）。其余像素保留原图不变。
      </div>

      {/* Off-screen canvases for actual pixel work */}
      <canvas ref={refCanvasRef} className="hidden" />
      <canvas ref={maskCanvasRef} className="hidden" />

      {/* Visible canvas — scaled by CSS, pixel-accurate internally */}
      <div className="border border-bg-border rounded-md overflow-hidden bg-bg-card inline-block">
        <canvas
          ref={dispCanvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: displaySize?.w ? `${displaySize.w}px` : 'auto',
            height: displaySize?.h ? `${displaySize.h}px` : 'auto',
            maxWidth: '100%',
            touchAction: 'none',
            cursor: eraser ? 'cell' : 'crosshair',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

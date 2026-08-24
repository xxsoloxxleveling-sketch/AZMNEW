import createGlobe, { COBEOptions } from 'cobe';
import React, { useEffect, useRef } from 'react';

export interface GlobeProps {
  className?: string;
  config?: Partial<COBEOptions>;
}

const DEFAULT_GLOBE_CONFIG: Omit<COBEOptions, 'width' | 'height'> = {
  devicePixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1,
  phi: 0,
  theta: 0.25,
  dark: 1,
  diffuse: 1.4,
  mapSamples: 9000, // Optimized for 60fps performance across all devices
  mapBrightness: 3.5,
  baseColor: [0.12, 0.28, 0.55], // Deep oceanic blue dots
  markerColor: [0.22, 0.85, 0.98], // Cyan marker highlight
  glowColor: [0.15, 0.45, 0.95], // Atmospheric cobalt glow
  markers: [
    // Hazara Division / Abbottabad / KP Region
    { location: [34.1688, 73.2215], size: 0.08 },
    // Islamabad / Rawalpindi
    { location: [33.6844, 73.0479], size: 0.06 },
    // Peshawar
    { location: [34.0151, 71.5249], size: 0.06 },
    // International scholarship connections
    { location: [51.5074, -0.1278], size: 0.04 },
    { location: [40.7128, -74.006], size: 0.04 },
    { location: [25.2048, 55.2708], size: 0.05 },
    { location: [1.3521, 103.8198], size: 0.04 }
  ],
};

export const Globe: React.FC<GlobeProps> = ({ className = '', config }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);

  useEffect(() => {
    // Check if mobile screen (< 768px) - skip heavy WebGL 9000-point globe on mobile for instant LCP/TBT
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) return;

    let phi = 0;
    let cachedRenderWidth = 600;
    let animationFrameId: number;
    let isVisible = true;
    let globe: any = null;

    const onResize = () => {
      if (canvasRef.current) {
        const measuredWidth = canvasRef.current.offsetWidth || 600;
        cachedRenderWidth = Math.min(measuredWidth * 1.5, 1200);
      }
    };
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (!canvasRef.current) return;

    const initialConfig: COBEOptions = {
      ...DEFAULT_GLOBE_CONFIG,
      ...(config || {}),
      width: cachedRenderWidth,
      height: cachedRenderWidth,
      baseColor: (config?.baseColor ?? DEFAULT_GLOBE_CONFIG.baseColor) as [number, number, number],
      markerColor: (config?.markerColor ?? DEFAULT_GLOBE_CONFIG.markerColor) as [number, number, number],
      glowColor: (config?.glowColor ?? DEFAULT_GLOBE_CONFIG.glowColor) as [number, number, number],
    };

    globe = createGlobe(canvasRef.current, initialConfig);

    const animate = () => {
      if (isVisible && globe) {
        if (pointerInteracting.current === null) {
          phi += 0.003;
        }
        // Use cachedRenderWidth (NO layout reads inside animation loop)
        globe.update({
          phi: phi + pointerInteractionMovement.current,
          width: cachedRenderWidth,
          height: cachedRenderWidth,
        });
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    // Defer animation slightly to yield main thread during initial paint
    const initTimer = setTimeout(() => {
      animate();
      if (canvasRef.current) {
        canvasRef.current.style.opacity = '1';
      }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      cancelAnimationFrame(animationFrameId);
      if (globe) globe.destroy();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config]);


  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[700px] lg:max-w-[850px] flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-0 transition-opacity duration-1000 ease-in-out [contain:layout_paint_size] pointer-events-auto cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.005;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.005;
          }
        }}
      />
    </div>
  );
};

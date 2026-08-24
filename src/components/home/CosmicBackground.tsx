import React, { useEffect, useRef } from 'react';
import { Globe } from '../ui/globe';

export const CosmicBackground: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Particle nodes: lightweight count on mobile (10), balanced on desktop (25)
    const particlesCount = isMobile ? 10 : Math.min(Math.floor((width * height) / 22000), 28);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
    }> = [];

    const colors = ['#60a5fa', '#38bdf8', '#34d399', '#93c5fd', '#ffffff'];

    for (let i = 0; i < particlesCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 1.2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let isVisible = true;
    const handleVisibility = () => {
      isVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const render = () => {
      if (isVisible) {
        ctx.clearRect(0, 0, width, height);

        // Constellation links only on desktop
        if (!isMobile) {
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const dx = particles[i].x - particles[j].x;
              const dy = particles[i].y - particles[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < 80) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                const lineAlpha = (1 - dist / 80) * 0.12;
                ctx.strokeStyle = `rgba(96, 165, 250, ${lineAlpha})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            }
          }
        }

        // Draw particle stars
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // Defer start to not block FCP
    const startTimer = setTimeout(() => {
      render();
    }, 600);

    return () => {
      clearTimeout(startTimer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };

  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep Cosmos Radial Vignette */}
      <div className="absolute inset-0 bg-radial-[at_50%_40%] from-transparent via-[#030712]/60 to-[#030712] z-1" />

      {/* Atmospheric Aurora Gradients */}
      <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-[#185b9d]/20 via-[#43cea2]/10 to-transparent blur-3xl rounded-full opacity-60 pointer-events-none" />
      <div className="absolute top-[40%] -left-[10%] w-[500px] h-[400px] bg-sky-600/10 blur-3xl rounded-full opacity-40 pointer-events-none" />
      <div className="absolute top-[30%] -right-[10%] w-[500px] h-[400px] bg-emerald-500/10 blur-3xl rounded-full opacity-30 pointer-events-none" />

      {/* Canvas for Particle Constellation Starfield */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-70 z-0"
      />

      {/* Interactive 3D Holographic WebGL Planetary Globe */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto opacity-75 z-0">
        <Globe className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] lg:w-[680px] lg:h-[680px] translate-y-12 sm:translate-y-8 lg:translate-y-4" />
      </div>

      {/* Subtle Coordinate Grid in Background */}
      <div className="absolute inset-0 bg-hero-grid opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />

      {/* Radial Gradient Mask for seamless blend */}
      <div className="pointer-events-none absolute inset-0 h-full bg-[radial-gradient(circle_at_50%_120%,rgba(3,7,18,0.85),rgba(3,7,18,0))]" />

      {/* Bottom Fade Mask into page content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030712] via-[#030712]/90 to-transparent" />
    </div>
  );
});

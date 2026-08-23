import React, { useEffect, useRef } from 'react';
import { Globe } from '../ui/globe';

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle nodes for subtle constellation networks
    const particlesCount = Math.min(Math.floor((width * height) / 16000), 45);
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
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.6 + 0.2,
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

        // Draw constellation links
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 100) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              const lineAlpha = (1 - dist / 100) * 0.15;
              ctx.strokeStyle = `rgba(96, 165, 250, ${lineAlpha})`;
              ctx.lineWidth = 0.6;
              ctx.stroke();
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

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };

  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Deep Midnight Atmosphere Base */}
      <div className="absolute inset-0 bg-[#030712] via-[#050e21] to-[#020617]" />

      {/* Atmospheric Radial Glow Behind Globe */}
      <div className="absolute top-1/4 sm:top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[850px] lg:w-[1100px] h-[600px] sm:h-[850px] lg:h-[1100px] rounded-full bg-radial from-[#1e40af]/30 via-[#0284c7]/15 to-transparent blur-3xl pointer-events-none" />

      {/* Magic UI 3D Interactive WebGL Globe */}
      <div className="absolute top-0 sm:top-4 lg:top-8 left-1/2 -translate-x-1/2 w-full max-w-[550px] sm:max-w-[700px] lg:max-w-[850px] pointer-events-none flex items-center justify-center opacity-85">
        <Globe className="relative top-0" />
      </div>

      {/* Subtle Coordinate Grid in Background */}
      <div className="absolute inset-0 bg-hero-grid opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />

      {/* Live Interactive Constellation Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-70" />

      {/* Magic UI Radial Gradient Mask for seamless blend */}
      <div className="pointer-events-none absolute inset-0 h-full bg-[radial-gradient(circle_at_50%_120%,rgba(3,7,18,0.85),rgba(3,7,18,0))]" />

      {/* Bottom Fade Mask into page content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030712] via-[#030712]/90 to-transparent" />
    </div>
  );
};

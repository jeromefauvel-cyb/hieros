"use client";

import { useEffect, useRef } from "react";

interface CarouselRendererProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CarouselRenderer({ html, className, style }: CarouselRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const carousels = containerRef.current.querySelectorAll<HTMLElement>(".media-carousel");

    const cleanups: (() => void)[] = [];

    carousels.forEach((carousel) => {
      const track = carousel.querySelector<HTMLElement>(".carousel-track");
      const slides = carousel.querySelectorAll<HTMLElement>(".carousel-slide");
      const prevBtn = carousel.querySelector<HTMLElement>(".carousel-prev");
      const nextBtn = carousel.querySelector<HTMLElement>(".carousel-next");
      const dotsContainer = carousel.querySelector<HTMLElement>(".carousel-dots");

      if (!track || slides.length === 0) return;

      let current = 0;
      const total = slides.length;

      // Create dots
      if (dotsContainer) {
        dotsContainer.innerHTML = "";
        for (let i = 0; i < total; i++) {
          const dot = document.createElement("button");
          dot.className = `carousel-dot ${i === 0 ? "active" : ""}`;
          dot.addEventListener("click", () => goTo(i));
          dotsContainer.appendChild(dot);
        }
      }

      function goTo(index: number) {
        current = ((index % total) + total) % total;
        if (track) {
          track.style.transform = `translateX(-${current * 100}%)`;
        }
        if (dotsContainer) {
          dotsContainer.querySelectorAll(".carousel-dot").forEach((d, i) => {
            d.classList.toggle("active", i === current);
          });
        }
      }

      const handlePrev = () => goTo(current - 1);
      const handleNext = () => goTo(current + 1);

      prevBtn?.addEventListener("click", handlePrev);
      nextBtn?.addEventListener("click", handleNext);

      // Auto-advance every 5s
      const interval = setInterval(() => goTo(current + 1), 5000);

      cleanups.push(() => {
        prevBtn?.removeEventListener("click", handlePrev);
        nextBtn?.removeEventListener("click", handleNext);
        clearInterval(interval);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Slide = { img: string; title: string; sub: string };

export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [viewportRef, api] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    const stop = () => setPaused(true);
    update();
    api.on("select", update).on("reInit", update).on("pointerDown", stop);
    return () => {
      api.off("select", update).off("reInit", update).off("pointerDown", stop);
    };
  }, [api]);

  useEffect(() => {
    if (!api || paused || hovered || focused || reducedMotion) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") api.scrollNext();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [api, selected, paused, hovered, focused, reducedMotion]);

  const navigate = useCallback((direction: number) => {
    setPaused(true);
    if (direction < 0) api?.scrollPrev(reducedMotion);
    else api?.scrollNext(reducedMotion);
  }, [api, reducedMotion]);

  return (
    <section
      role="region"
      aria-roledescription="carrusel"
      aria-label="Destacados de El Arcángel"
      className="relative overflow-hidden bg-secondary"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        navigate(event.key === "ArrowLeft" ? -1 : 1);
      }}
    >
      <div ref={viewportRef} className="overflow-hidden touch-pan-y touch-pinch-zoom">
        <div className="flex">
          {slides.map((slide, index) => (
            <div
              key={slide.title}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${slides.length}: ${slide.title}`}
              aria-hidden={index !== selected}
              inert={index !== selected}
              className="relative h-[320px] min-w-0 shrink-0 basis-full sm:h-[420px]"
            >
              <Link to="/productos" draggable={false} className="absolute inset-0 block select-none">
                <img
                  src={slide.img}
                  alt={slide.title}
                  draggable={false}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/80 to-secondary/20 sm:via-secondary/50 sm:to-transparent" />
                <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-6 pb-16 sm:px-20 sm:pb-8">
                  <h1 className="text-4xl font-extrabold lowercase tracking-normal text-primary sm:text-7xl">{slide.title}</h1>
                  <p className="mt-3 max-w-[28rem] text-base font-semibold leading-relaxed text-foreground sm:mt-4 sm:text-2xl">{slide.sub}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-3 flex items-center justify-between sm:inset-x-6 sm:bottom-4">
        <Button size="icon" variant="outline" aria-label="Diapositiva anterior" onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-card/90 sm:absolute sm:bottom-[170px] sm:left-0">
          <ChevronLeft />
        </Button>
        <div className="flex items-center sm:mx-auto" aria-label="Elegir diapositiva">
          {slides.map((slide, index) => (
            <Button
              key={slide.title}
              variant="ghost"
              size="icon"
              aria-label={`Ver diapositiva ${index + 1}: ${slide.title}`}
              aria-current={index === selected ? "true" : undefined}
              onClick={() => { setPaused(true); api?.scrollTo(index, reducedMotion); }}
              className="h-11 w-11 rounded-full"
            >
              <span className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === selected ? "w-6 bg-primary" : "w-2.5 bg-foreground/40"}`} />
            </Button>
          ))}
          {!reducedMotion && (
            <Button size="icon" variant="ghost" aria-label={paused ? "Reanudar presentación" : "Pausar presentación"} onClick={() => setPaused((value) => !value)} className="h-11 w-11 rounded-full">
              {paused ? <Play /> : <Pause />}
            </Button>
          )}
        </div>
        <Button size="icon" variant="outline" aria-label="Diapositiva siguiente" onClick={() => navigate(1)} className="h-11 w-11 rounded-full bg-card/90 sm:absolute sm:bottom-[170px] sm:right-0">
          <ChevronRight />
        </Button>
      </div>
    </section>
  );
}
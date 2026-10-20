import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

type Slide = { img: string; title: string; sub: string; mobileObject?: string; search?: { categoria?: string } };

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
              <Link to="/productos" search={slide.search ?? {}} draggable={false} className="absolute inset-0 flex flex-col select-none sm:block">
                <div className="relative h-[190px] shrink-0 overflow-hidden sm:hidden">
                  <img
                    src={slide.img}
                    alt={slide.title}
                    draggable={false}
                    loading={index === 0 ? "eager" : "lazy"}
                    className={`h-full w-full object-cover ${slide.mobileObject ?? "object-center"}`}
                  />
                </div>
                <div className="flex flex-1 flex-col justify-center bg-secondary px-5 pb-10 sm:hidden">
                  <h1 className="text-3xl font-extrabold tracking-normal text-primary">{slide.title}</h1>
                  <p className="mt-1.5 max-w-[24rem] text-sm font-semibold leading-relaxed text-foreground">{slide.sub}</p>
                </div>
                <div className="hidden h-full sm:block">
                  <img
                    src={slide.img}
                    alt={slide.title}
                    draggable={false}
                    loading={index === 0 ? "eager" : "lazy"}
                    className="h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/50 to-transparent" />
                  <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-20 pb-8">
                    <h1 className="text-7xl font-extrabold tracking-normal text-primary">{slide.title}</h1>
                    <p className="mt-4 max-w-[28rem] text-2xl font-semibold leading-relaxed text-foreground">{slide.sub}</p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center sm:bottom-4">
        <div className="pointer-events-auto flex items-center rounded-full bg-card/70 px-0.5" aria-label="Elegir diapositiva">
          {slides.map((slide, index) => (
            <Button
              key={slide.title}
              variant="ghost"
              size="icon"
              aria-label={`Ver diapositiva ${index + 1}: ${slide.title}`}
              aria-current={index === selected ? "true" : undefined}
              onClick={() => { setPaused(true); api?.scrollTo(index, reducedMotion); }}
              className="h-7 w-7 rounded-full sm:h-11 sm:w-11"
            >
              <span className={`block rounded-full transition-all motion-reduce:transition-none ${index === selected ? "h-2 w-4 bg-primary sm:h-2.5 sm:w-6" : "h-2 w-2 bg-foreground/40 sm:h-2.5 sm:w-2.5"}`} />
            </Button>
          ))}
          {!reducedMotion && (
            <Button size="icon" variant="ghost" aria-label={paused ? "Reanudar presentación" : "Pausar presentación"} onClick={() => setPaused((value) => !value)} className="h-7 w-7 rounded-full sm:h-11 sm:w-11">
              {paused ? <Play /> : <Pause />}
            </Button>
          )}
        </div>
      </div>

      <Button size="icon" variant="outline" aria-label="Diapositiva anterior" onClick={() => navigate(-1)} className="pointer-events-auto absolute left-2 top-[95px] h-9 w-9 -translate-y-1/2 rounded-full bg-card/90 sm:top-auto sm:bottom-[170px] sm:left-0 sm:h-11 sm:w-11 sm:translate-y-0">
        <ChevronLeft />
      </Button>
      <Button size="icon" variant="outline" aria-label="Diapositiva siguiente" onClick={() => navigate(1)} className="pointer-events-auto absolute right-2 top-[95px] h-9 w-9 -translate-y-1/2 rounded-full bg-card/90 sm:top-auto sm:bottom-[170px] sm:right-0 sm:h-11 sm:w-11 sm:translate-y-0">
        <ChevronRight />
      </Button>
    </section>
  );
}

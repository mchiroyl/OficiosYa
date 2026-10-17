import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/Icons';
import styles from './WorkerGallery.module.css';

/**
 * Galería / carrusel de trabajos realizados (HU-06).
 * Sin dependencias externas: scroll-snap + controles accesibles.
 */
export default function WorkerGallery({ images = [], title = 'Trabajos realizados' }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const labelId = useId();
  const total = images.length;

  const scrollToIndex = useCallback((nextIndex) => {
    const track = trackRef.current;
    if (!track || total === 0) return;

    const clamped = ((nextIndex % total) + total) % total;
    const slide = track.children[clamped];
    if (!slide) return;

    const targetLeft =
      slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    setIndex(clamped);
  }, [total]);

  const syncIndexFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || total === 0) return;

    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;

    Array.from(track.children).forEach((child, i) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });

    setIndex(closest);
  }, [total]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncIndexFromScroll);
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
    };
  }, [syncIndexFromScroll]);

  if (total === 0) {
    return (
      <section className={styles.section} aria-labelledby={labelId}>
        <h2 id={labelId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.empty}>Aún no hay fotografías de trabajos.</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby={labelId}>
      <div className={styles.header}>
        <h2 id={labelId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.counter} aria-live="polite">
          {index + 1} / {total}
        </p>
      </div>

      <div className={styles.viewport}>
        <div
          ref={trackRef}
          className={styles.track}
          tabIndex={0}
          role="region"
          aria-roledescription="carrusel"
          aria-label={title}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              scrollToIndex(index - 1);
            }
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              scrollToIndex(index + 1);
            }
          }}
        >
          {images.map((image, i) => (
            <figure
              key={image.id ?? i}
              className={styles.slide}
              aria-hidden={i !== index}
            >
              <img
                src={image.src}
                alt={image.alt || `Trabajo realizado ${i + 1}`}
                className={styles.image}
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </figure>
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              className={[styles.navBtn, styles.prev].join(' ')}
              onClick={() => scrollToIndex(index - 1)}
              aria-label="Imagen anterior"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className={[styles.navBtn, styles.next].join(' ')}
              onClick={() => scrollToIndex(index + 1)}
              aria-label="Imagen siguiente"
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className={styles.dots} role="tablist" aria-label="Seleccionar imagen">
          {images.map((image, i) => (
            <button
              key={image.id ?? i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ir a imagen ${i + 1}`}
              className={[styles.dot, i === index ? styles.dotActive : ''].join(' ')}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

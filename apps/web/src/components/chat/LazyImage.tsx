'use client';

import { useRef, useState, useEffect, memo } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Root margin for IntersectionObserver (default: '100px') */
  rootMargin?: string;
}

/**
 * LazyImage — only loads and renders the image when it scrolls into view.
 * Uses IntersectionObserver with a generous rootMargin for pre-fetching.
 * Shows a lightweight placeholder until visible.
 */
function LazyImageInner({ src, alt, className, rootMargin = '100px' }: LazyImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isVisible ? (
        <img
          src={src}
          alt={alt}
          className={className}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        />
      ) : (
        /* Lightweight skeleton placeholder */
        <div
          style={{
            width: '70%',
            height: '70%',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
      )}
    </div>
  );
}

export const LazyImage = memo(LazyImageInner);

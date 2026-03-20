'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** Tooltip text */
  content: string;
  /** Trigger element(s) */
  children: React.ReactNode;
  /** Placement preference */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing (ms) */
  delay?: number;
}

/**
 * Reusable tooltip rendered via portal — never clipped by overflow.
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [placement, setPlacement] = useState(position);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const calculate = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;

    let x = rect.left + rect.width / 2;
    let y = rect.top - gap;
    let finalPos = position;

    // Auto-flip if near edge
    if (position === 'top' && rect.top < 40) {
      finalPos = 'bottom';
      y = rect.bottom + gap;
    } else if (position === 'bottom' && window.innerHeight - rect.bottom < 40) {
      finalPos = 'top';
      y = rect.top - gap;
    } else if (position === 'left' && rect.left < 100) {
      finalPos = 'right';
    } else if (position === 'right' && window.innerWidth - rect.right < 100) {
      finalPos = 'left';
    }

    if (finalPos === 'bottom') {
      y = rect.bottom + gap;
    } else if (finalPos === 'left') {
      x = rect.left - gap;
      y = rect.top + rect.height / 2;
    } else if (finalPos === 'right') {
      x = rect.right + gap;
      y = rect.top + rect.height / 2;
    }

    setCoords({ x, y });
    setPlacement(finalPos);
  }, [position]);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      calculate();
      setVisible(true);
    }, delay);
  }, [calculate, delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Clamp tooltip to viewport after render
  useEffect(() => {
    if (!visible || !tooltipRef.current) return;
    const tip = tooltipRef.current;
    const rect = tip.getBoundingClientRect();
    const pad = 8;
    if (rect.right > window.innerWidth - pad) {
      tip.style.left = `${window.innerWidth - rect.width - pad}px`;
      tip.style.transform = 'none';
    }
    if (rect.left < pad) {
      tip.style.left = `${pad}px`;
      tip.style.transform = 'none';
    }
  }, [visible, coords]);

  if (!content) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={styles.trigger}
      >
        {children}
      </span>
      {visible &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`${styles.tooltip} ${styles[placement]}`}
            style={{ left: coords.x, top: coords.y }}
            role="tooltip"
          >
            {content}
            <span className={styles.arrow} />
          </div>,
          document.body,
        )}
    </>
  );
}

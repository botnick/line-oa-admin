'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import styles from './Lightbox.module.css';

interface LightboxItem {
  src: string;
  type?: 'image' | 'video';
  alt?: string;
}

interface LightboxProps {
  /** Single source (legacy) */
  src?: string;
  alt?: string;
  type?: 'image' | 'video';
  /** Gallery mode: array of items */
  items?: LightboxItem[];
  /** Initial index for gallery mode */
  initialIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen lightbox with gallery mode.
 * - Click backdrop anywhere to close
 * - Arrow keys / buttons for prev/next in gallery
 * - Zoom in/out for images
 * - Counter badge "2/5"
 * - Blur backdrop + centered content
 */
export function Lightbox({
  src,
  alt = '',
  type = 'image',
  items,
  initialIndex = 0,
  onClose,
}: LightboxProps) {
  // Normalize into gallery items
  const gallery: LightboxItem[] = items ?? [{ src: src!, type, alt }];
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const current = gallery[currentIndex];
  const hasMultiple = gallery.length > 1;

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(idx);
    setScale(1); // Reset zoom on navigate
  }, []);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  const goNext = useCallback(() => {
    if (currentIndex < gallery.length - 1) goTo(currentIndex + 1);
  }, [currentIndex, gallery.length, goTo]);

  // Keyboard: Escape, Left, Right
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': goPrev(); break;
        case 'ArrowRight': goNext(); break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.5, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = current.src;
    a.download = current.alt || 'download';
    a.target = '_blank';
    a.click();
  };

  const isImage = (current.type ?? 'image') === 'image';

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      {/* Top bar */}
      <div className={styles.topBar}>
        {/* Counter */}
        {hasMultiple && (
          <div className={styles.counter}>
            {currentIndex + 1} / {gallery.length}
          </div>
        )}

        <div className={styles.topBarActions}>
          {isImage && (
            <>
              <Tooltip content="ย่อ">
                <button className={styles.actionBtn} onClick={handleZoomOut}>
                  <ZoomOut size={20} />
                </button>
              </Tooltip>
              <Tooltip content="ขยาย">
                <button className={styles.actionBtn} onClick={handleZoomIn}>
                  <ZoomIn size={20} />
                </button>
              </Tooltip>
            </>
          )}
          <Tooltip content="ดาวน์โหลด">
            <button className={styles.actionBtn} onClick={handleDownload}>
              <Download size={20} />
            </button>
          </Tooltip>
          <Tooltip content="ปิด">
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={22} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Prev button */}
      {hasMultiple && currentIndex > 0 && (
        <button
          className={`${styles.navBtn} ${styles.navPrev}`}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="ก่อนหน้า"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Next button */}
      {hasMultiple && currentIndex < gallery.length - 1 && (
        <button
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="ถัดไป"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Content — centered */}
      <div className={styles.content} onClick={handleBackdropClick}>
        {isImage ? (
          <img
            key={current.src}
            src={current.src}
            alt={current.alt || ''}
            className={styles.image}
            style={{ transform: `scale(${scale})` }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        ) : (
          <video
            key={current.src}
            src={current.src}
            controls
            autoPlay
            className={styles.video}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, memo } from 'react';
import {
  LINE_STICKER_PACKS,
  getStickerIds,
  getStickerUrl,
  getPackThumbnail,
} from '@/lib/lineStickerData';
import { LazyImage } from './LazyImage';
import styles from './StickerPicker.module.css';

interface StickerPickerProps {
  onSelect: (packageId: number, stickerId: number) => void;
  onClose: () => void;
}

/**
 * LINE Sticker Picker — tab-based scrollable grid with lazy-loaded images.
 * Top: pack tabs with pack thumbnail.
 * Body: scrollable sticker grid for selected pack (lazy loaded).
 */
function StickerPickerInner({ onSelect, onClose }: StickerPickerProps) {
  const [activePackIdx, setActivePackIdx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const activePack = LINE_STICKER_PACKS[activePackIdx];
  const stickerIds = getStickerIds(activePack);

  const handleTabClick = useCallback((idx: number) => {
    setActivePackIdx(idx);
    // Scroll grid to top when switching packs
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, []);

  const handleStickerClick = useCallback(
    (stickerId: number) => {
      onSelect(activePack.packageId, stickerId);
      onClose();
    },
    [activePack.packageId, onSelect, onClose]
  );

  return (
    <div className={styles.picker}>
      {/* Pack tabs - horizontal scrollable */}
      <div className={styles.tabs}>
        {LINE_STICKER_PACKS.map((pack, idx) => (
          <button
            key={pack.packageId}
            className={`${styles.tab} ${idx === activePackIdx ? styles.tabActive : ''}`}
            onClick={() => handleTabClick(idx)}
            title={pack.name}
          >
            <img
              src={getPackThumbnail(pack)}
              alt={pack.name}
              className={styles.tabImg}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Sticker grid - scrollable with lazy-loaded images */}
      <div className={styles.grid} ref={gridRef}>
        {stickerIds.map((id) => (
          <button
            key={id}
            className={styles.stickerBtn}
            onClick={() => handleStickerClick(id)}
          >
            <LazyImage
              src={getStickerUrl(id)}
              alt={`Sticker ${id}`}
              className={styles.stickerImg}
              rootMargin="50px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export const StickerPicker = memo(StickerPickerInner);

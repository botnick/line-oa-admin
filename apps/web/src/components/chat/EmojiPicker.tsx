'use client';

import { useState, useRef, useCallback, memo } from 'react';
import {
  LINE_EMOJI_PRODUCTS,
  getEmojiIds,
  getEmojiUrl,
  getProductThumbnail,
} from '@/lib/lineEmojiData';
import { LazyImage } from './LazyImage';
import styles from './EmojiPicker.module.css';

interface EmojiPickerProps {
  onSelect: (productId: string, emojiId: string) => void;
  onClose: () => void;
}

/**
 * LINE Emoji Picker — tab-based scrollable grid with lazy-loaded images.
 * Top: product category tabs with thumbnails.
 * Body: scrollable emoji grid for selected product (140-252 emojis, lazy loaded).
 */
function EmojiPickerInner({ onSelect, onClose }: EmojiPickerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const activeProduct = LINE_EMOJI_PRODUCTS[activeIdx];
  const emojiIds = getEmojiIds(activeProduct);

  const handleTabClick = useCallback((idx: number) => {
    setActiveIdx(idx);
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, []);

  const handleEmojiClick = useCallback(
    (emojiId: string) => {
      onSelect(activeProduct.productId, emojiId);
      onClose();
    },
    [activeProduct.productId, onSelect, onClose]
  );

  return (
    <div className={styles.picker}>
      {/* Product tabs - horizontal scrollable */}
      <div className={styles.tabs}>
        {LINE_EMOJI_PRODUCTS.map((product, idx) => (
          <button
            key={product.productId}
            className={`${styles.tab} ${idx === activeIdx ? styles.tabActive : ''}`}
            onClick={() => handleTabClick(idx)}
            title={product.name}
          >
            <img
              src={getProductThumbnail(product)}
              alt={product.name}
              className={styles.tabImg}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Product name label */}
      <div className={styles.label}>
        {activeProduct.name}
        <span className={styles.count}>{activeProduct.count}</span>
      </div>

      {/* Emoji grid - lazy loaded */}
      <div className={styles.grid} ref={gridRef}>
        {emojiIds.map((id) => (
          <button
            key={id}
            className={styles.emojiBtn}
            onClick={() => handleEmojiClick(id)}
          >
            <LazyImage
              src={getEmojiUrl(activeProduct.productId, id)}
              alt={`Emoji ${id}`}
              className={styles.emojiImg}
              rootMargin="80px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export const EmojiPicker = memo(EmojiPickerInner);

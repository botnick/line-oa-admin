'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { Sticker, Smile, X } from 'lucide-react';
import {
  LINE_STICKER_PACKS,
  getStickerIds,
  getStickerUrl,
  getPackThumbnail,
} from '@/lib/lineStickerData';
import {
  LINE_EMOJI_PRODUCTS,
  getEmojiIds,
  getEmojiUrl,
  getProductThumbnail,
} from '@/lib/lineEmojiData';
import { LazyImage } from './LazyImage';
import styles from './StickerEmojiPicker.module.css';

type PickerMode = 'sticker' | 'emoji';

interface StickerEmojiPickerProps {
  initialMode?: PickerMode;
  onSelectSticker: (packageId: number, stickerId: number) => void;
  onSelectEmoji: (productId: string, emojiId: string) => void;
  onClose: () => void;
}

/**
 * Unified LINE Sticker + Emoji Picker
 * Top bar: mode tabs (sticker / emoji)
 * Sub bar: pack/product thumbnail tabs (scrollable)
 * Body: scrollable grid of stickers or emojis
 */
function StickerEmojiPickerInner({
  initialMode = 'sticker',
  onSelectSticker,
  onSelectEmoji,
  onClose,
}: StickerEmojiPickerProps) {
  const [mode, setMode] = useState<PickerMode>(initialMode);
  const [stickerPackIdx, setStickerPackIdx] = useState(0);
  const [emojiProductIdx, setEmojiProductIdx] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reset grid scroll on pack/product change
  const scrollToTop = useCallback(() => {
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, []);

  // ─── Mode switching ───
  const handleModeSwitch = useCallback(
    (m: PickerMode) => {
      setMode(m);
      scrollToTop();
    },
    [scrollToTop]
  );

  // ─── Tab switching ───
  const handleStickerTabClick = useCallback(
    (idx: number) => {
      setStickerPackIdx(idx);
      scrollToTop();
    },
    [scrollToTop]
  );

  const handleEmojiTabClick = useCallback(
    (idx: number) => {
      setEmojiProductIdx(idx);
      scrollToTop();
    },
    [scrollToTop]
  );

  // ─── Selection handlers ───
  const handleStickerClick = useCallback(
    (stickerId: number) => {
      const pack = LINE_STICKER_PACKS[stickerPackIdx];
      onSelectSticker(pack.packageId, stickerId);
      onClose();
    },
    [stickerPackIdx, onSelectSticker, onClose]
  );

  const handleEmojiClick = useCallback(
    (emojiId: string) => {
      const product = LINE_EMOJI_PRODUCTS[emojiProductIdx];
      onSelectEmoji(product.productId, emojiId);
      // NOTE: Don't close picker — allow continuous emoji insertion
    },
    [emojiProductIdx, onSelectEmoji]
  );

  // ─── Current data ───
  const activeStickerPack = LINE_STICKER_PACKS[stickerPackIdx];
  const stickerIds = getStickerIds(activeStickerPack);
  const activeEmojiProduct = LINE_EMOJI_PRODUCTS[emojiProductIdx];
  const emojiIds = getEmojiIds(activeEmojiProduct);

  return (
    <div className={styles.picker}>
      {/* ─── Top: Mode tabs (sticker / emoji) + close ─── */}
      <div className={styles.modeBar}>
        <button
          className={`${styles.modeTab} ${mode === 'sticker' ? styles.modeTabActive : ''}`}
          onClick={() => handleModeSwitch('sticker')}
          type="button"
        >
          <Sticker size={16} />
          <span>สติ๊กเกอร์</span>
        </button>
        <button
          className={`${styles.modeTab} ${mode === 'emoji' ? styles.modeTabActive : ''}`}
          onClick={() => handleModeSwitch('emoji')}
          type="button"
        >
          <Smile size={16} />
          <span>อีโมจิ</span>
        </button>
        <button
          className={styles.closeBtn}
          onClick={onClose}
          type="button"
          aria-label="ปิด"
        >
          <X size={16} />
        </button>
      </div>

      {/* ─── Sub-tabs: Pack / Product thumbnails (scrollable) ─── */}
      {mode === 'sticker' ? (
        <div className={styles.subTabs}>
          {LINE_STICKER_PACKS.map((pack, idx) => (
            <button
              key={pack.packageId}
              className={`${styles.subTab} ${idx === stickerPackIdx ? styles.subTabActive : ''}`}
              onClick={() => handleStickerTabClick(idx)}
              title={pack.name}
              type="button"
            >
              <img
                src={getPackThumbnail(pack)}
                alt={pack.name}
                className={styles.subTabImg}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.subTabs}>
          {LINE_EMOJI_PRODUCTS.map((product, idx) => (
            <button
              key={product.productId}
              className={`${styles.subTab} ${idx === emojiProductIdx ? styles.subTabActive : ''}`}
              onClick={() => handleEmojiTabClick(idx)}
              title={product.name}
              type="button"
            >
              <img
                src={getProductThumbnail(product)}
                alt={product.name}
                className={styles.subTabImg}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* ─── Grid ─── */}
      <div
        className={mode === 'sticker' ? styles.stickerGrid : styles.emojiGrid}
        ref={gridRef}
      >
        {mode === 'sticker'
          ? stickerIds.map((id) => (
              <button
                key={id}
                className={styles.stickerBtn}
                onClick={() => handleStickerClick(id)}
                type="button"
              >
                <LazyImage
                  src={getStickerUrl(id)}
                  alt={`Sticker ${id}`}
                  className={styles.itemImg}
                  rootMargin="50px"
                />
              </button>
            ))
          : emojiIds.map((id) => (
              <button
                key={id}
                className={styles.emojiBtn}
                onClick={() => handleEmojiClick(id)}
                type="button"
              >
                <LazyImage
                  src={getEmojiUrl(activeEmojiProduct.productId, id)}
                  alt={`Emoji ${id}`}
                  className={styles.itemImg}
                  rootMargin="80px"
                />
              </button>
            ))}
      </div>
    </div>
  );
}

export const StickerEmojiPicker = memo(StickerEmojiPickerInner);

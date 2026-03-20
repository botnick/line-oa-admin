'use client';

import { useState, memo } from 'react';
import { formatTime } from '@/lib/dayjs';
import { Lightbox } from './Lightbox';
import styles from './ImageGrid.module.css';

interface Attachment {
  id: string;
  type: string;
  processingStatus: string;
  previewUrl?: string | null;
  originalUrl?: string | null;
}

export interface ImageGroupMsg {
  id: string;
  createdAt: Date | string;
  attachments?: Attachment[];
}

interface ImageGridProps {
  messages: ImageGroupMsg[];
  source: 'INBOUND' | 'OUTBOUND';
}

/**
 * ImageGrid — LINE-style grouped image display.
 *
 * Layout rules:
 * - 1 image: full width
 * - Even count: pairs of 2 per row
 * - Odd count: pairs of 2, last image full width (like LINE)
 * - Max 10 images
 */
function ImageGridInner({ messages, source }: ImageGridProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const isOutbound = source === 'OUTBOUND';

  // Build image URLs from attachments
  const images = messages
    .map((msg) => {
      const att = msg.attachments?.[0];
      if (att?.processingStatus !== 'COMPLETED') return null;
      return {
        preview: att.previewUrl || att.originalUrl || '',
        full: att.originalUrl || att.previewUrl || '',
      };
    })
    .filter(Boolean) as { preview: string; full: string }[];

  if (images.length === 0) return null;

  const count = images.length;
  const lastMsg = messages[messages.length - 1];
  const time = formatTime(lastMsg.createdAt);

  // Determine grid class based on count
  let gridClass = styles.grid1;
  if (count === 2) gridClass = styles.grid2;
  else if (count === 3) gridClass = styles.grid3;
  else if (count === 4) gridClass = styles.grid4;
  else if (count >= 5) gridClass = styles.gridN;

  // For count >= 5, split into pairs + possible last
  const isOdd = count % 2 !== 0;

  return (
    <>
      <div className={`${styles.wrapper} ${isOutbound ? styles.outbound : styles.inbound}`}>
        <div className={`${styles.grid} ${gridClass}`}>
          {count <= 4 ? (
            // Simple grids: 1-4
            images.map((img, idx) => (
              <button
                key={idx}
                className={`${styles.imgBtn} ${
                  count === 3 && idx === 2 ? styles.imgFull : ''
                }`}
                onClick={() => setLightboxIdx(idx)}
              >
                <img
                  src={img.preview}
                  alt={`รูปที่ ${idx + 1}`}
                  className={styles.img}
                  loading="lazy"
                />
              </button>
            ))
          ) : (
            // 5+ images: pairs, last odd one is full width
            <>
              {images.map((img, idx) => {
                const isLast = idx === count - 1;
                const isFullWidth = isOdd && isLast;
                return (
                  <button
                    key={idx}
                    className={`${styles.imgBtn} ${isFullWidth ? styles.imgFull : ''}`}
                    onClick={() => setLightboxIdx(idx)}
                  >
                    <img
                      src={img.preview}
                      alt={`รูปที่ ${idx + 1}`}
                      className={styles.img}
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </>
          )}
        </div>
        <div className={styles.meta}>
          <span className={styles.time}>{time}</span>
        </div>
      </div>

      {/* Gallery Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          items={images.map((img) => ({ src: img.full, type: 'image' as const }))}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}

export const ImageGrid = memo(ImageGridInner);

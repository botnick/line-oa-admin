'use client';

import { useState } from 'react';
import { formatTime } from '@/lib/dayjs';
import { Lightbox } from './Lightbox';
import styles from './ChatBubble.module.css';

export interface ChatBubbleProps {
  source: 'INBOUND' | 'OUTBOUND';
  type: string;
  textContent?: string | null;
  metadata?: any;
  stickerPackageId?: string | null;
  stickerId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  createdAt: Date | string;
  deliveryStatus?: string | null;
  sentByName?: string | null;
  attachments?: {
    id: string;
    type: string;
    processingStatus: string;
    r2KeyThumbnail?: string | null;
    r2KeyPreview?: string | null;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    originalUrl?: string | null;
    originalWidth?: number | null;
    originalHeight?: number | null;
    durationMs?: number | null;
    originalFilename?: string | null;
    originalSize?: number | null;
  }[];
  highlightQuery?: string | null;
  isHighlighted?: boolean;
  sentByAvatarUrl?: string | null;
}

/**
 * Chat message bubble.
 * Inbound messages appear on the left, outbound on the right.
 * Images and videos render inline with lightbox on click.
 */
export function ChatBubble({
  source,
  type,
  textContent,
  metadata,
  stickerPackageId,
  stickerId,
  latitude,
  longitude,
  address,
  createdAt,
  deliveryStatus,
  sentByName,
  attachments,
  highlightQuery,
  isHighlighted,
  sentByAvatarUrl,
}: ChatBubbleProps) {
  const isOutbound = source === 'OUTBOUND';
  const time = formatTime(createdAt);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<'image' | 'video'>('image');

  const att = attachments?.[0];
  const isMediaReady = att?.processingStatus === 'COMPLETED';

  const openLightbox = (src: string, mediaType: 'image' | 'video' = 'image') => {
    setLightboxSrc(src);
    setLightboxType(mediaType);
  };

  const renderTextWithHighlights = (text: string) => {
    if (!highlightQuery) return text;
    // Escape regex characters
    const safeQuery = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${safeQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === highlightQuery.toLowerCase() ? (
        <mark key={i} className={styles.highlightMark}>{part}</mark>
      ) : (
        part
      )
    );
  };

  const renderContent = () => {
    switch (type) {
      case 'TEXT':
        if (metadata?.lineEmojis && Array.isArray(metadata.lineEmojis) && metadata.lineEmojis.length > 0) {
          const emojis = metadata.lineEmojis.sort((a: any, b: any) => a.index - b.index);
          const result: React.ReactNode[] = [];
          const text = textContent || '';
          let currentIndex = 0;
          
          for (const emoji of emojis) {
            if (emoji.index > currentIndex) {
              result.push(renderTextWithHighlights(text.substring(currentIndex, emoji.index)));
            }
            result.push(
              <img
                key={`${emoji.index}-${emoji.emojiId}`}
                src={`https://stickershop.line-scdn.net/sticonshop/v1/sticon/${emoji.productId}/android/${emoji.emojiId}.png`}
                className={styles.inlineEmoji}
                alt="😊"
                loading="lazy"
                onError={(e) => {
                  const span = document.createElement('span');
                  span.textContent = '😊';
                  span.style.fontSize = '1.2em';
                  (e.target as HTMLElement).replaceWith(span);
                }}
              />
            );
            currentIndex = emoji.index + (emoji.length || 1);
          }
          if (currentIndex < text.length) {
            result.push(renderTextWithHighlights(text.substring(currentIndex)));
          }
          
          return <p className={styles.text}>{result}</p>;
        }
        // Fallback: strip lone `$` placeholder chars that weren't replaced by emoji
        if (textContent && textContent.includes('$')) {
          return <p className={styles.text}>{renderTextWithHighlights(textContent.replace(/\$/g, '😊'))}</p>;
        }
        return <p className={styles.text}>{renderTextWithHighlights(textContent || '')}</p>;

      case 'IMAGE':
        if (isMediaReady && (att?.previewUrl || att?.originalUrl)) {
          const previewSrc = att.previewUrl || att.originalUrl!;
          const fullSrc = att.originalUrl || previewSrc;
          return (
            <button
              className={styles.mediaButton}
              onClick={() => openLightbox(fullSrc, 'image')}
              type="button"
            >
              <img
                src={previewSrc}
                alt="รูปภาพ"
                className={styles.mediaImage}
                loading="lazy"
              />
              <div className={styles.mediaOverlay}>🔍</div>
            </button>
          );
        }
        return (
          <div className={styles.mediaPlaceholder}>
            <div className={styles.placeholderSpinner} />
            📷 กำลังโหลดรูป...
          </div>
        );

      case 'VIDEO':
        if (isMediaReady && (att?.previewUrl || att?.originalUrl)) {
          const videoSrc = att.originalUrl || att.previewUrl!;
          return (
            <button
              className={styles.mediaButton}
              onClick={() => openLightbox(videoSrc, 'video')}
              type="button"
            >
              <div className={styles.videoThumb}>
                <span className={styles.playIcon}>▶</span>
                <span className={styles.videoDuration}>
                  {att.durationMs ? `${Math.round(att.durationMs / 1000)}s` : 'วิดีโอ'}
                </span>
              </div>
            </button>
          );
        }
        return (
          <div className={styles.mediaPlaceholder}>
            <div className={styles.placeholderSpinner} />
            🎥 กำลังโหลดวิดีโอ...
          </div>
        );

      case 'AUDIO':
        if (isMediaReady && att?.originalUrl) {
          return (
            <audio
              src={att.originalUrl}
              controls
              className={styles.audioPlayer}
            />
          );
        }
        return <div className={styles.mediaPlaceholder}>🎵 เสียง</div>;

      case 'STICKER':
        if (stickerPackageId && stickerId) {
          return (
            <img
              src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`}
              alt="สติ๊กเกอร์"
              className={styles.stickerImg}
              loading="lazy"
            />
          );
        }
        return <div className={styles.sticker}>😊</div>;

      case 'LOCATION':
        return (
          <div className={styles.location}>
            📍 {address ?? 'ตำแหน่ง'}
            {latitude && longitude && (
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapLink}
              >
                ดูแผนที่
              </a>
            )}
          </div>
        );

      case 'FILE':
        const rawName = att?.originalFilename || 'document';
        const fileExt = rawName.split('.').pop()?.toUpperCase() || 'FILE';
        const fileSizeKB = att?.originalSize ? Math.round(att.originalSize / 1024) : 0;
        const fileSizeDisplay = fileSizeKB >= 1024
          ? `${(fileSizeKB / 1024).toFixed(1)} MB`
          : fileSizeKB > 0 ? `${fileSizeKB} KB` : 'Unknown';
        // Truncate long filenames for title display
        const displayName = rawName.length > 30
          ? rawName.substring(0, 27) + '...'
          : rawName;
        
        const cardContent = (
          <div className={styles.fileCard}>
            <div className={styles.fileCardHeader}>
              <div className={styles.fileIconWrapper}></div>
              <div className={styles.fileInfo}>
                <div className={styles.fileName} title={rawName}>{displayName}</div>
                <div className={styles.fileDetails}>
                  <span>Type : {fileExt}</span>
                  <span>Size : {fileSizeDisplay}</span>
                </div>
              </div>
            </div>
            <div className={styles.fileDownloadBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </div>
          </div>
        );

        if (isMediaReady && att?.originalUrl) {
          return (
            <a
              href={att.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fileLinkWrapper}
            >
              {cardContent}
            </a>
          );
        }
        return cardContent;

      default:
        return <p className={styles.text}>{textContent ?? `[${type}]`}</p>;
    }
  };

  const isMediaType = ['IMAGE', 'VIDEO'].includes(type) && isMediaReady;
  const isFileType = type === 'FILE';

  return (
    <>
      <div className={`${styles.wrapper} ${isOutbound ? styles.outbound : styles.inbound} ${isHighlighted ? styles.highlightedBubbleItem : ''}`}>
        <div className={`${styles.bubble} ${isOutbound ? styles.bubbleOutbound : styles.bubbleInbound} ${isMediaType ? styles.bubbleMedia : ''} ${isFileType ? styles.bubbleFile : ''} ${isHighlighted ? styles.highlightedBg : ''}`}>
          {renderContent()}
          <div className={styles.meta}>
            {isOutbound && (
              <span className={styles.sentBy}>
                {sentByName ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {sentByName}
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    LINE Official
                  </>
                )}
              </span>
            )}
            <span className={styles.time}>{time}</span>
            {isOutbound && deliveryStatus && (
              <span className={styles.status}>
                {deliveryStatus === 'SENT' ? '✓' : deliveryStatus === 'DELIVERED' ? '✓✓' : '⏳'}
              </span>
            )}
          </div>
        </div>
        {isOutbound && (
          <div className={styles.adminAvatar}>
            {sentByAvatarUrl ? (
              <img src={sentByAvatarUrl} alt="" className={styles.adminAvatarImg} />
            ) : (
              <div className={styles.adminAvatarFallback}>
                {(sentByName || 'A').replace(/^[^a-zA-Z0-9ก-๙]+/, '').charAt(0).toUpperCase() || 'A'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <Lightbox
          src={lightboxSrc}
          type={lightboxType}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}

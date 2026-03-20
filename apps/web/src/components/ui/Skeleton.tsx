import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Width (CSS value) */
  width?: string;
  /** Height (CSS value) */
  height?: string;
  /** Variant shape */
  variant?: 'text' | 'textSm' | 'circle' | 'avatar' | 'rect';
  /** Additional className */
  className?: string;
  /** Custom inline styles */
  style?: CSSProperties;
}

/**
 * Skeleton loading placeholder
 * @example
 * <Skeleton variant="avatar" />
 * <Skeleton variant="text" width="60%" />
 * <Skeleton width="100px" height="40px" />
 */
export function Skeleton({
  width,
  height,
  variant = 'rect',
  className = '',
  style,
}: SkeletonProps) {
  const variantClass = variant !== 'rect' ? styles[variant] : '';

  return (
    <div
      className={`${styles.skeleton} ${variantClass} ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Pre-built chat row skeleton for inbox loading */
export function ChatRowSkeleton() {
  return (
    <div className={styles.chatRow}>
      <Skeleton variant="avatar" />
      <div className={styles.chatRowContent}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="textSm" width="70%" />
      </div>
    </div>
  );
}

/** Inbox skeleton — multiple chat rows */
export function InboxSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <ChatRowSkeleton key={i} />
      ))}
    </>
  );
}

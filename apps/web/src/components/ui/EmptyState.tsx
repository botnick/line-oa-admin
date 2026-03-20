import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * Empty state placeholder for lists/search with icon, Thai title, and optional description.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <Icon className={styles.icon} size={48} strokeWidth={1.5} />
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
  );
}

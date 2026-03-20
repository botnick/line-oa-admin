import styles from './EmptyChatState.module.css';

interface EmptyChatStateProps {
  title?: string;
  description?: string;
}

export function EmptyChatState({ 
  title = 'ยังไม่ได้เลือกแชท', 
  description = 'เลือกการสนทนาจากรายการด้านซ้ายเพื่อเริ่มข้อความ'
}: EmptyChatStateProps) {
  return (
    <div className={styles.emptyChatState}>
      <div className={styles.emptyChatContent}>
        <div className={styles.emptyChatIconWrapper}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className={styles.emptyChatTitle}>{title}</h3>
        <p className={styles.emptyChatDescription}>{description}</p>
      </div>
    </div>
  );
}

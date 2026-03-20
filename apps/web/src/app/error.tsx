'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      padding: '24px',
      textAlign: 'center',
      gap: '16px',
      backgroundColor: 'var(--color-bg)'
    }}>
      <div style={{ padding: '24px', background: 'var(--color-bg-elevated)', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <AlertCircle size={48} style={{ color: '#ff4d4f', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          ระบบทำงานขัดข้อง
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '16px auto', lineHeight: '1.6' }}>
          ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองโหลดหน้านี้ใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากปัญหายังคงอยู่
        </p>
        <button
          onClick={() => reset()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            fontWeight: 600,
            marginTop: '8px',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          <RefreshCw size={18} />
          ลองใหม่
        </button>
      </div>
    </div>
  );
}

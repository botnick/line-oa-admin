'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '../ui/Tooltip';
import styles from './FileUploadButton.module.css';

interface FileUploadButtonProps {
  conversationId: string;
  onUploadComplete?: () => void;
  disabled?: boolean;
}

interface UploadPreview {
  file: File;
  previewUrl: string | null;
  isImage: boolean;
}

/**
 * File upload button + preview modal + progress.
 * Uploads to R2 via /api/upload, then creates message via tRPC sendMedia.
 */
export function FileUploadButton({
  conversationId,
  onUploadComplete,
  disabled = false,
}: FileUploadButtonProps) {
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const sendMediaMutation = trpc.messages.sendMedia.useMutation({
    onSettled: () => {
      utils.messages.list.invalidate({ conversationId });
      utils.conversations.list.invalidate();
      // Claim happened on backend — refresh notification state
      utils.notifications.list.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const handleClick = () => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    setPreview({ file, previewUrl, isImage });

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleCancel = useCallback(() => {
    if (preview?.previewUrl) {
      URL.revokeObjectURL(preview.previewUrl);
    }
    setPreview(null);
    setProgress(0);
  }, [preview]);

  const handleSend = useCallback(async () => {
    if (!preview || uploading) return;

    setUploading(true);
    setProgress(10);

    try {
      // Step 1: Upload file to R2
      const formData = new FormData();
      formData.append('file', preview.file);

      setProgress(30);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      setProgress(70);

      const { key, url, mimeType } = await uploadRes.json();

      // Step 2: Create message via tRPC
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      const type = isImage ? 'IMAGE' as const : isVideo ? 'VIDEO' as const : 'FILE' as const;

      await sendMediaMutation.mutateAsync({
        conversationId,
        r2Key: key,
        url,
        mimeType,
        fileName: preview.file.name,
        size: preview.file.size,
        type,
      });

      setProgress(100);

      if (preview.previewUrl) {
        URL.revokeObjectURL(preview.previewUrl);
      }
      setPreview(null);
      onUploadComplete?.();
    } catch (error) {
      console.error('[FileUpload] Error:', error);
      toast.error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [preview, uploading, conversationId, onUploadComplete, sendMediaMutation]);

  return (
    <>
      <Tooltip content="แนบไฟล์">
        <button
          className={styles.btn}
          onClick={handleClick}
          disabled={disabled || uploading}
          type="button"
        >
          <Paperclip size={20} />
        </button>
      </Tooltip>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        onChange={handleFileSelect}
        className={styles.hiddenInput}
      />

      {/* Preview Modal */}
      {preview && (
        <div className={styles.overlay} onClick={uploading ? undefined : handleCancel}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>ส่งไฟล์</span>
              <button
                className={styles.closeBtn}
                onClick={handleCancel}
                disabled={uploading}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.previewArea}>
              {preview.isImage && preview.previewUrl ? (
                <img
                  src={preview.previewUrl}
                  alt="Preview"
                  className={styles.previewImage}
                />
              ) : (
                <div className={styles.filePreview}>
                  <FileText size={48} />
                  <span className={styles.fileName}>{preview.file.name}</span>
                  <span className={styles.fileSize}>
                    {(preview.file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>

            {uploading && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={handleCancel}
                disabled={uploading}
              >
                ยกเลิก
              </button>
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 size={16} className={styles.spinner} />
                ) : (
                  <Upload size={16} />
                )}
                {uploading ? 'กำลังส่ง...' : 'ส่ง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, Smile, MessageSquarePlus, ShieldOff } from 'lucide-react';
import { StickerEmojiPicker } from './StickerEmojiPicker';
import { QuickReplyPicker } from './QuickReplyPicker';
import { FileUploadButton } from './FileUploadButton';
import { getEmojiUrl } from '@/lib/lineEmojiData';
import { trpc } from '@/lib/trpc';
import { Tooltip } from '../ui/Tooltip';
import styles from './Composer.module.css';

/** LINE Messaging API text limit */
const LINE_TEXT_LIMIT = 2000;

/** LINE emoji entry for API payload */
export interface LineEmoji {
  index: number;
  productId: string;
  emojiId: string;
}

export interface ComposerProps {
  conversationId: string;
  onSend: (text: string, emojis?: LineEmoji[]) => void;
  onSendSticker?: (packageId: number, stickerId: number) => void;
  onUploadComplete?: () => void;
  disabled?: boolean;
  /** When set, shows an overlay blocking the composer with this message */
  blockedMessage?: string | null;
}

/**
 * Parse contentEditable innerHTML → { text, emojis }
 *
 * Text nodes become plain text.
 * <img data-product-id="..." data-emoji-id="..."> become `$` with emoji entry.
 * <br> / <div> become newlines.
 */
function parseComposerContent(
  el: HTMLDivElement
): { text: string; emojis: LineEmoji[] } {
  const emojis: LineEmoji[] = [];
  let text = '';

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      // Inline emoji image → $
      if (tag === 'img') {
        const productId = element.getAttribute('data-product-id');
        const emojiId = element.getAttribute('data-emoji-id');
        if (productId && emojiId) {
          emojis.push({ index: text.length, productId, emojiId });
          text += '$';
        }
        return;
      }

      // Line breaks
      if (tag === 'br') {
        text += '\n';
        return;
      }

      // Block elements → newline before (except first)
      if (tag === 'div' || tag === 'p') {
        if (text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
        return;
      }

      // Other elements → recurse
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
    }
  }

  for (const child of Array.from(el.childNodes)) {
    walk(child);
  }

  return { text, emojis };
}

/**
 * Message composer — contentEditable text input with inline emoji support.
 * Emoji images are inserted at cursor position; on send → LINE API format.
 */
export function Composer({
  conversationId,
  onSend,
  onSendSticker,
  onUploadComplete,
  disabled = false,
  blockedMessage,
}: ComposerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

  // ─── Quick Reply shortcuts ───
  const { data: quickReplies } = trpc.quickReplies.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  const shortcutMap = useMemo(() => {
    const map = new Map<string, string>();
    if (quickReplies) {
      for (const qr of quickReplies) {
        if (qr.shortcut) {
          map.set(qr.shortcut.toLowerCase(), qr.content);
        }
      }
    }
    return map;
  }, [quickReplies]);
  // Track content changes for canSend + character count
  const checkContent = useCallback(() => {
    if (!editorRef.current) return;
    const { text } = parseComposerContent(editorRef.current);
    const count = text.length;
    setCharCount(count);
    const hasImages = editorRef.current.querySelector('img') !== null;
    setHasContent(text.trim().length > 0 || hasImages);
  }, []);

  const isOverLimit = charCount > LINE_TEXT_LIMIT;

  const handleSend = useCallback(() => {
    if (!editorRef.current || disabled) return;

    const { text, emojis } = parseComposerContent(editorRef.current);
    const trimmed = text.trim();

    if (!trimmed && emojis.length === 0) return;

    // Block send if over character limit
    if (trimmed.length > LINE_TEXT_LIMIT) return;

    // Recalculate emoji indices after trimming leading whitespace
    const leadingSpaces = text.length - text.trimStart().length;
    const adjustedEmojis = emojis.map((e) => ({
      ...e,
      index: e.index - leadingSpaces,
    }));

    onSend(trimmed, adjustedEmojis.length > 0 ? adjustedEmojis : undefined);

    // Clear editor
    editorRef.current.innerHTML = '';
    setHasContent(false);
    setCharCount(0);
  }, [disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // ─── Quick reply shortcut detection on Space or Enter ───
      if ((e.key === ' ' || e.key === 'Enter') && !e.shiftKey && editorRef.current) {
        const { text } = parseComposerContent(editorRef.current);
        const trimmed = text.trim();
        // Only match if the entire text is a shortcut (no other content)
        if (trimmed && shortcutMap.has(trimmed.toLowerCase())) {
          e.preventDefault();
          const content = shortcutMap.get(trimmed.toLowerCase())!;
          // If Enter was pressed and the shortcut text matches → send directly
          if (e.key === 'Enter') {
            onSend(content);
            editorRef.current.innerHTML = '';
            setHasContent(false);
            setCharCount(0);
            return;
          }
          // Space → replace content in editor
          editorRef.current.innerText = content;
          // Move cursor to end
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          checkContent();
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, shortcutMap, checkContent, onSend]
  );

  // Insert emoji image at cursor position
  const insertEmoji = useCallback(
    (productId: string, emojiId: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      // Ensure editor is focused
      editor.focus();

      // Create emoji <img> element
      const img = document.createElement('img');
      img.src = getEmojiUrl(productId, emojiId);
      img.alt = `emoji-${emojiId}`;
      img.setAttribute('data-product-id', productId);
      img.setAttribute('data-emoji-id', emojiId);
      img.className = styles.inlineEmoji;
      img.draggable = false;
      img.contentEditable = 'false';

      // Insert at cursor or append at end
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // Only use the selection if it's inside our editor
        if (editor.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(img);
          // Move cursor after the image
          range.setStartAfter(img);
          range.setEndAfter(img);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          editor.appendChild(img);
        }
      } else {
        editor.appendChild(img);
      }

      checkContent();
    },
    [checkContent]
  );

  const togglePicker = useCallback(() => {
    setPickerOpen((prev) => !prev);
    if (!pickerOpen) setQuickReplyOpen(false);
  }, [pickerOpen]);

  const toggleQuickReply = useCallback(() => {
    setQuickReplyOpen((prev) => !prev);
    if (!quickReplyOpen) setPickerOpen(false);
  }, [quickReplyOpen]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleStickerSelect = useCallback(
    (packageId: number, stickerId: number) => {
      onSendSticker?.(packageId, stickerId);
      setPickerOpen(false);
    },
    [onSendSticker]
  );

  const handleEmojiSelect = useCallback(
    (productId: string, emojiId: string) => {
      // Insert inline — do NOT close picker
      insertEmoji(productId, emojiId);
    },
    [insertEmoji]
  );

  const handleQuickReplySelect = useCallback((content: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    
    // Insert text at cursor position or append
    editor.focus();
    document.execCommand('insertText', false, content);
    checkContent();
    setQuickReplyOpen(false);
  }, [checkContent]);

  // Handle paste: only plain text (strip HTML)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const plainText = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, plainText);
      checkContent();
    },
    [checkContent]
  );

  const canSend = hasContent && !disabled && !isOverLimit;

  return (
    <div className={styles.composerWrapper}>
      {/* Blocked / unfollowed overlay */}
      {blockedMessage && (
        <div className={styles.blockedOverlay}>
          <ShieldOff size={16} />
          <span>{blockedMessage}</span>
        </div>
      )}
      {/* Unified sticker + emoji picker popup */}
      {pickerOpen && (
        <div className={styles.pickerPopup}>
          <StickerEmojiPicker
            onSelectSticker={handleStickerSelect}
            onSelectEmoji={handleEmojiSelect}
            onClose={closePicker}
          />
        </div>
      )}

      {/* Quick Reply picker popup */}
      {quickReplyOpen && (
        <div className={styles.pickerPopup}>
          <QuickReplyPicker
            onSelect={handleQuickReplySelect}
            onClose={() => setQuickReplyOpen(false)}
          />
        </div>
      )}

      <div className={styles.composer}>
        {/* ContentEditable text input — full width on top */}
        <div className={styles.inputWrapper}>
          <div
            ref={editorRef}
            className={`${styles.input} ${isOverLimit ? styles.inputOverLimit : ''} ${charCount === 0 ? styles.inputCompact : ''}`}
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={checkContent}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            data-placeholder="Enter: ส่ง, Shift + Enter: ขึ้นบรรทัดใหม่"
            role="textbox"
            aria-label="พิมพ์ข้อความ"
          />
          {/* Pill badge character counter */}
          {charCount > 0 && (
            <div className={`${styles.charCounter} ${isOverLimit ? styles.charCounterOver : charCount > LINE_TEXT_LIMIT * 0.9 ? styles.charCounterWarn : ''}`}>
              {charCount.toLocaleString()}/{LINE_TEXT_LIMIT.toLocaleString()}
            </div>
          )}
        </div>

        {/* Bottom bar: actions left, send right */}
        <div className={styles.bottomBar}>
          <div className={styles.actions}>
            <Tooltip content="สติ๊กเกอร์ / อีโมจิ">
              <button
                className={`${styles.actionBtn} ${pickerOpen ? styles.actionBtnActive : ''}`}
                onClick={togglePicker}
                type="button"
                disabled={disabled}
              >
                <Smile size={20} />
              </button>
            </Tooltip>
            <Tooltip content="ข้อความตอบกลับด่วน">
              <button
                className={`${styles.actionBtn} ${quickReplyOpen ? styles.actionBtnActive : ''}`}
                onClick={toggleQuickReply}
                type="button"
                disabled={disabled}
              >
                <MessageSquarePlus size={20} />
              </button>
            </Tooltip>
            <FileUploadButton
              conversationId={conversationId}
              onUploadComplete={onUploadComplete}
              disabled={disabled}
            />
          </div>

          {/* Send button */}
          <button
            className={`${styles.sendButton} ${canSend ? styles.sendButtonActive : ''}`}
            onClick={handleSend}
            disabled={!canSend}
            type="button"
            aria-label="ส่งข้อความ"
          >
            <Send size={14} />
            <span>ส่ง</span>
          </button>
        </div>
      </div>
    </div>
  );
}

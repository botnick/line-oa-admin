'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './ColorPicker.module.css';

/**
 * Curated color palette — grouped by hue family.
 * These are handpicked to look great as chips/labels.
 */
const COLOR_PRESETS = [
  // Reds
  '#ef4444', '#f97316', '#f59e0b',
  // Greens
  '#22c55e', '#10b981', '#06b6d4',
  // Blues
  '#3b82f6', '#6366f1', '#8b5cf6',
  // Pinks / Neutrals
  '#ec4899', '#f43f5e', '#a855f7',
  // Muted / Soft
  '#14b8a6', '#0ea5e9', '#64748b',
  // Earth tones
  '#d97706', '#059669', '#7c3aed',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  /** Size of swatches */
  size?: 'sm' | 'md';
}

/**
 * Beautiful color swatch picker — no native picker needed.
 * Shows as inline grid or as inline popover toggle.
 */
export function ColorPicker({ value, onChange, size = 'sm' }: ColorPickerProps) {
  return (
    <div className={styles.grid} data-size={size}>
      {COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          className={`${styles.swatch} ${value === color ? styles.swatchActive : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={`เลือกสี ${color}`}
        />
      ))}
    </div>
  );
}

/**
 * Color picker that shows in a popover triggered by a small dot button.
 */
export function ColorPickerPopover({ value, onChange, size = 'sm' }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position popover below trigger on open
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.left + rect.width / 2 - 100), // center, min 8px from left
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className={styles.popoverWrap} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        style={{ background: value }}
        onClick={() => setOpen((v) => !v)}
        aria-label="เลือกสี"
      />
      {open && (
        <div
          className={styles.popover}
          style={{ top: pos.top, left: pos.left }}
        >
          <ColorPicker
            value={value}
            onChange={(c) => { onChange(c); setOpen(false); }}
            size={size}
          />
        </div>
      )}
    </div>
  );
}

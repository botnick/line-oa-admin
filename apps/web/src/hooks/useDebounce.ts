'use client';

import { useState, useEffect } from 'react';

/**
 * Debounce a value by a given delay (ms).
 * Useful for search inputs — waits until user stops typing.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

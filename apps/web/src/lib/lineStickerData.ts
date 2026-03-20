/**
 * LINE Official Sticker Packages available for Messaging API.
 * Source: https://developers.line.biz/en/docs/messaging-api/sticker-list/
 *
 * Sticker image URL pattern:
 *   https://stickershop.line-scdn.net/stickershop/v1/sticker/{stickerId}/iPhone/sticker@2x.png
 *
 * Counts verified by clicking "Show all" on the LINE docs page.
 */

export interface StickerPack {
  packageId: number;
  name: string;
  /** First sticker ID in the pack */
  firstStickerId: number;
  /** Number of stickers in the pack (verified full count) */
  count: number;
}

/** All available LINE sticker packs for Messaging API (full counts) */
export const LINE_STICKER_PACKS: StickerPack[] = [
  { packageId: 446,   name: 'Moon: Special Edition',             firstStickerId: 1988,     count: 40 },
  { packageId: 789,   name: 'Sally: Special Edition',            firstStickerId: 10855,    count: 40 },
  { packageId: 6136,  name: 'LINE Characters: Making Amends',  firstStickerId: 10551376, count: 24 },
  { packageId: 6359,  name: 'Brown and Cony Fun Size Pack',            firstStickerId: 11069848, count: 24 },
  { packageId: 8522,  name: 'LINE Characters: Pretty Phrase',          firstStickerId: 16581266, count: 24 },
  { packageId: 11537, name: 'Brown & Cony & Sally: Animated Special',  firstStickerId: 52002734, count: 40 },
  { packageId: 11538, name: 'CHOCO & Friends: Animated Special',    firstStickerId: 51626494, count: 40 },
  { packageId: 11539, name: 'UNIVERSTAR BT21: Animated Special',     firstStickerId: 52114110, count: 40 },
];

/**
 * Generate sticker IDs for a pack.
 */
export function getStickerIds(pack: StickerPack): number[] {
  return Array.from({ length: pack.count }, (_, i) => pack.firstStickerId + i);
}

/**
 * Get LINE sticker image URL.
 * Uses LINE CDN with @2x resolution for retina displays.
 */
export function getStickerUrl(stickerId: number): string {
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`;
}

/**
 * Get sticker pack thumbnail (first sticker's image).
 */
export function getPackThumbnail(pack: StickerPack): string {
  return getStickerUrl(pack.firstStickerId);
}

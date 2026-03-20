/**
 * LINE Emoji Product definitions for Messaging API.
 * Source: https://developers.line.biz/en/docs/messaging-api/emoji-list/
 *
 * Emoji image URL pattern:
 *   https://stickershop.line-scdn.net/sticonshop/v1/sticon/{productId}/iPhone/{emojiId}.png
 *
 * Counts verified by clicking "Show all" on the LINE docs page.
 * Emoji IDs are zero-padded 3-digit strings: "001", "002", ..., "211"
 */

export interface EmojiProduct {
  productId: string;
  name: string;
  /** Number of emojis in this product (verified full count) */
  count: number;
}

/** All available LINE emoji products for Messaging API (full counts) */
export const LINE_EMOJI_PRODUCTS: EmojiProduct[] = [
  { productId: '670e0cce840a8236ddd4ee4c', name: 'Faces',           count: 211 },
  { productId: '5ac2213e040ab15980c9b447', name: 'Brown & Friends', count: 182 },
  { productId: '5ac21a8c040ab15980c9b43f', name: 'Brown',           count: 149 },
  { productId: '5ac21e6c040ab15980c9b444', name: 'Sally',           count: 222 },
  { productId: '5ac1bfd5040ab15980c9b435', name: 'Moon',            count: 250 },
  { productId: '5ac22e85040ab15980c9b44f', name: 'Boss',            count: 209 },
  { productId: '5ac22775040ab15980c9b44c', name: 'Jessica',         count: 247 },
  { productId: '5ac2197b040ab15980c9b43d', name: 'Edward',          count: 201 },
  { productId: '5ac21d59031a6752fb806d5d', name: 'Leonard',         count: 212 },
  { productId: '5ac221ca040ab15980c9b449', name: 'Choco',           count: 167 },
  { productId: '5ac22bad031a6752fb806d67', name: 'Pangyo',          count: 214 },
  { productId: '5ac2211e031a6752fb806d61', name: 'Daily Life',      count: 250 },
  { productId: '5ac21b4f031a6752fb806d59', name: 'Love',            count: 149 },
  { productId: '5ac21fda040ab15980c9b446', name: 'Weather',         count: 140 },
  { productId: '5ac22224031a6752fb806d62', name: 'Food',            count: 251 },
  { productId: '5ac22c9e031a6752fb806d68', name: 'Travel',          count: 198 },
  { productId: '5ac222bf031a6752fb806d64', name: 'Work',            count: 250 },
  { productId: '5ac21869040ab15980c9b43b', name: 'Sports',          count: 199 },
  { productId: '5ac2280f031a6752fb806d65', name: 'Music',           count: 250 },
  { productId: '5ac22293031a6752fb806d63', name: 'Shopping',        count: 184 },
  { productId: '5ac2173d031a6752fb806d56', name: 'Pets',            count: 240 },
  { productId: '5ac21542031a6752fb806d55', name: 'Signs',           count: 248 },
  { productId: '5ac2216f040ab15980c9b448', name: 'Arrows',          count: 188 },
  { productId: '5ac21f52040ab15980c9b445', name: 'Stars',           count: 183 },
  { productId: '5ac21ef5031a6752fb806d5e', name: 'Hearts',          count: 150 },
  { productId: '5ac223c6040ab15980c9b44a', name: 'Flowers',         count: 157 },
  { productId: '5ac22b23040ab15980c9b44d', name: 'Symbols',         count: 247 },
  { productId: '5ac22def040ab15980c9b44e', name: 'Numbers',         count: 250 },
  { productId: '5ac21c46040ab15980c9b442', name: 'Alphabet A-I',    count: 221 },
  { productId: '5ac22d62031a6752fb806d69', name: 'Alphabet J-R',    count: 196 },
  { productId: '5ac21a13031a6752fb806d57', name: 'Alphabet S-Z',    count: 149 },
  { productId: '5ac21a18040ab15980c9b43e', name: 'Emoticons',       count: 239 },
  { productId: '5ac2264e040ab15980c9b44b', name: 'Seasonal',        count: 252 },
  { productId: '5ac2206d031a6752fb806d5f', name: 'Thanks',          count: 252 },
  { productId: '5ac220c2031a6752fb806d60', name: 'Sorry',           count: 246 },
  { productId: '5ac22a8c031a6752fb806d66', name: 'Congrats',        count: 210 },
  { productId: '5ac1de17040ab15980c9b438', name: 'Party',           count: 194 },
  { productId: '5ac21cc5031a6752fb806d5c', name: 'OK/NG',           count: 170 },
  { productId: '5ac21ae3040ab15980c9b440', name: 'Greetings',       count: 149 },
  { productId: '5ac218e3040ab15980c9b43c', name: 'Bye',             count: 221 },
  { productId: '5ac21184040ab15980c9b43a', name: 'Clock',           count: 234 },
];

/**
 * Generate emoji IDs for a product (001 to N, zero-padded to 3 digits).
 */
export function getEmojiIds(product: EmojiProduct): string[] {
  return Array.from(
    { length: product.count },
    (_, i) => String(i + 1).padStart(3, '0')
  );
}

/**
 * Get LINE emoji image URL from CDN.
 */
export function getEmojiUrl(productId: string, emojiId: string): string {
  return `https://stickershop.line-scdn.net/sticonshop/v1/sticon/${productId}/iPhone/${emojiId}.png`;
}

/**
 * Get emoji product thumbnail (first emoji's image).
 */
export function getProductThumbnail(product: EmojiProduct): string {
  return getEmojiUrl(product.productId, '001');
}

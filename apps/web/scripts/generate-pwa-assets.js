const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SPLASH_DIR = path.join(__dirname, '../public/splash');

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });
if (!fs.existsSync(SPLASH_DIR)) fs.mkdirSync(SPLASH_DIR, { recursive: true });

// A unique, minimalist textless chat bubble on the original green background (#06c755)
const BASE_SIZE = 1024;

const svgBuffer = Buffer.from(`
<svg width="${BASE_SIZE}" height="${BASE_SIZE}" viewBox="0 0 ${BASE_SIZE} ${BASE_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#004d1d" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="${BASE_SIZE}" height="${BASE_SIZE}" fill="#06c755"/>

  <g transform="translate(162, 162) scale(0.68)" filter="url(#shadow)">
    <!-- Back translucent bubble for depth/uniqueness -->
    <path d="M 640 200 C 420 200 240 340 240 500 C 240 590 300 660 380 720 C 400 740 420 800 390 850 C 430 810 520 780 580 740 C 600 745 620 745 640 745 C 860 745 1040 605 1040 500 C 1040 340 860 200 640 200 Z" fill="#ffffff" opacity="0.4"/>
    
    <!-- Front solid white bubble -->
    <path d="M 400 300 C 180 300 0 440 0 600 C 0 690 60 760 140 820 C 160 840 180 900 150 950 C 190 910 280 880 340 840 C 360 845 380 845 400 845 C 620 845 800 705 800 600 C 800 440 620 300 400 300 Z" fill="#ffffff"/>
    
    <!-- Inner geometric cutouts -->
    <circle cx="260" cy="560" r="45" fill="#06c755"/>
    <rect x="340" y="535" width="220" height="50" rx="25" fill="#06c755"/>
    <circle cx="515" cy="655" r="45" fill="#06c755"/>
    <rect x="240" y="630" width="235" height="50" rx="25" fill="#06c755"/>
  </g>
</svg>
`);

const maskableSvgBuffer = Buffer.from(`
<svg width="${BASE_SIZE}" height="${BASE_SIZE}" viewBox="0 0 ${BASE_SIZE} ${BASE_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#004d1d" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Full background for maskable -->
  <rect width="${BASE_SIZE}" height="${BASE_SIZE}" fill="#06c755"/>

  <!-- Centered and scaled for safe zone -->
  <g transform="translate(204, 204) scale(0.6)" filter="url(#shadow)">
    <path d="M 640 200 C 420 200 240 340 240 500 C 240 590 300 660 380 720 C 400 740 420 800 390 850 C 430 810 520 780 580 740 C 600 745 620 745 640 745 C 860 745 1040 605 1040 500 C 1040 340 860 200 640 200 Z" fill="#ffffff" opacity="0.4"/>
    <path d="M 400 300 C 180 300 0 440 0 600 C 0 690 60 760 140 820 C 160 840 180 900 150 950 C 190 910 280 880 340 840 C 360 845 380 845 400 845 C 620 845 800 705 800 600 C 800 440 620 300 400 300 Z" fill="#ffffff"/>
    <circle cx="260" cy="560" r="45" fill="#06c755"/>
    <rect x="340" y="535" width="220" height="50" rx="25" fill="#06c755"/>
    <circle cx="515" cy="655" r="45" fill="#06c755"/>
    <rect x="240" y="630" width="235" height="50" rx="25" fill="#06c755"/>
  </g>
</svg>
`);

const icons = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'icon-maskable-192.png', size: 192, isMaskable: true },
  { name: 'icon-maskable-512.png', size: 512, isMaskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
];

async function generateAssets() {
  console.log('🎨 Generating PWA Icons...');
  
  for (const icon of icons) {
    const buffer = icon.isMaskable ? maskableSvgBuffer : svgBuffer;
    await sharp(buffer).resize(icon.size, icon.size).png().toFile(path.join(ICONS_DIR, icon.name));
    console.log(`  ✅ ${icon.name}`);
  }

  console.log('📎 Generating favicon.ico (fallback)...');
  fs.copyFileSync(
    path.join(ICONS_DIR, 'favicon-32x32.png'),
    path.join(__dirname, '../public/favicon.ico')
  );

  // ── OG / Social Media Images ──────────────────────────────
  console.log('\n🌐 Generating OG / Social Media Images...');

  const opentype = require('opentype.js');
  const FONTS_DIR = path.join(__dirname, '../public/fonts');
  const fontHeavy = opentype.loadSync(path.join(FONTS_DIR, 'LINESeedSansTH_W_He.woff'));
  const fontRegular = opentype.loadSync(path.join(FONTS_DIR, 'LINESeedSansTH_W_Rg.woff'));
  const fontBold = opentype.loadSync(path.join(FONTS_DIR, 'LINESeedSansTH_W_Bd.woff'));

  const ogSizes = [
    { name: 'og-image.png', w: 1200, h: 630, dir: ICONS_DIR },
    { name: 'twitter-image.png', w: 1200, h: 600, dir: ICONS_DIR },
    { name: 'og-image-square.png', w: 1200, h: 1200, dir: ICONS_DIR },
    { name: 'apple-splash-1290-2796.png', w: 1290, h: 2796, dir: SPLASH_DIR },
  ];

  for (const og of ogSizes) {
    const isSquare = og.w === og.h;
    const isPortrait = og.h > og.w;
    const logoSize = Math.floor(Math.min(og.w, og.h) * (isSquare ? 0.25 : 0.30));
    const logoBuffer = await sharp(maskableSvgBuffer)
      .resize(logoSize, logoSize, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const titleSize = 66;
    const taglineSize = 40;
    
    // Push logo down slightly more on portrait screens
    const logoTop = Math.floor(og.h * (isSquare ? 0.20 : isPortrait ? 0.30 : 0.12));
    
    const titleY = logoTop + logoSize + (isSquare ? 120 : 90);
    const taglineY = titleY + 60;
    const ctaY = taglineY + 100;
    
    const getCenteredText = (font, text, y, size) => {
      const width = font.getAdvanceWidth(text, size);
      const startX = (og.w - width) / 2;
      return { path: font.getPath(text, startX, y, size).toPathData(), width };
    };

    const titleText = "LINE Official Account : ADMIN";
    const { path: titlePath } = getCenteredText(fontHeavy, titleText, titleY, titleSize);
    
    const taglineText = "ระบบจัดการแชท สำหรับ LINE Official Account";
    const { path: taglinePath } = getCenteredText(fontRegular, taglineText, taglineY, taglineSize);

    const ctaText = "Get Started";
    const ctaSize = 30;
    
    const { path: ctaTextPath, width: ctaTextWidth } = getCenteredText(fontBold, ctaText, ctaY, ctaSize);
    
    const px = 48;
    const py = 18;
    
    const ctaBbox = fontBold.getPath(ctaText, 0, 0, ctaSize).getBoundingBox();
    const ctaVisualHeight = ctaBbox.y2 - ctaBbox.y1;
    const ctaCenterOffY = (ctaBbox.y1 + ctaBbox.y2) / 2;
    
    const btnHeight = ctaVisualHeight + py * 2;
    const btnWidth = ctaTextWidth + px * 2;
    const btnX = (og.w - btnWidth) / 2;
    
    const btnY = ctaY + ctaCenterOffY - btnHeight / 2;

    const textSvg = Buffer.from(`
    <svg width="${og.w}" height="${og.h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="15" flood-color="#000000" flood-opacity="0.12"/>
        </filter>
      </defs>

      <path d="${titlePath}" fill="#ffffff" />
      <path d="${taglinePath}" fill="rgba(255, 255, 255, 0.9)" />
      
      <!-- CTA Button Background -->
      <rect x="${btnX}" y="${btnY}" width="${btnWidth}" height="${btnHeight}" rx="${btnHeight / 2}" fill="#ffffff" filter="url(#shadow)" />
      
      <!-- CTA Text -->
      <path d="${ctaTextPath}" fill="#06c755" />
    </svg>
    `);

    await sharp({
      create: { width: og.w, height: og.h, channels: 4, background: '#06c755' }
    })
      .composite([
        { input: logoBuffer, gravity: 'north', top: logoTop, left: Math.floor((og.w - logoSize) / 2) },
        { input: textSvg, gravity: 'northwest', top: 0, left: 0 },
      ])
      .png()
      .toFile(path.join(og.dir, og.name));
    console.log(`  ✅ ${og.name}`);
  }

  console.log(`\n🎉 Done! Generated ${icons.length} icons + ${ogSizes.length} OG images`);
}

generateAssets().then(() => console.log('✨ All PWA assets generated successfully!')).catch(console.error);

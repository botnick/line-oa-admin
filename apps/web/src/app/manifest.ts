import type { MetadataRoute } from 'next';
import { getSettings } from '@line-oa/config/settings';

export default function manifest(): MetadataRoute.Manifest {
  const { app } = getSettings();
  const name = app.appName || 'LINE OA Admin';

  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: `${name} คือระบบจัดการข้อความ LINE Official Account แบบครบวงจร รองรับแชท, CRM, ระบบตอบกลับอัตโนมัติ และวิเคราะห์ข้อมูลลูกค้าแบบเรียลไทม์`,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06c755',
    theme_color: '#06c755',
    categories: ['business', 'productivity', 'social'],
    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      {
        src: '/icons/og-image.png',
        sizes: '1200x630',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Desktop view of LINE OA Admin dashboard',
      },
      {
        src: '/splash/apple-splash-1290-2796.png',
        sizes: '1290x2796',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Mobile view of LINE OA Admin',
      },
    ],
  };
}

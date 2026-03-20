import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { TRPCProvider } from '@/lib/trpc';
import { Toaster } from 'sonner';
import { getSettings } from '@line-oa/config/settings';
import './globals.css';


export async function generateMetadata(): Promise<Metadata> {
  const { app } = getSettings();
  const appName = app.appName || 'LINE OA Admin';
  const baseUrl = app.baseUrl || 'http://localhost:3333';

  // 53 characters -> Optimal for SEO
  const fullTitle = `${appName} — ระบบจัดการข้อความและ CRM แบบครบวงจร`;
  const fullDescription =
    `${appName} คือระบบจัดการข้อความ LINE Official Account แบบครบวงจร รองรับแชท, CRM, ระบบตอบกลับอัตโนมัติ และวิเคราะห์ข้อมูลลูกค้าแบบเรียลไทม์`;

  return {
    metadataBase: new URL(baseUrl),
    title: { template: `%s — ${appName}`, default: fullTitle },
    description: fullDescription,
    applicationName: appName,
    authors: [{ name: appName }],
    generator: 'Next.js',
    keywords: [
      'LINE', 'OA', 'Admin', 'Dashboard', 'CRM',
      'LINE Official Account', 'จัดการข้อความ', 'แชทบอท',
      'ระบบตอบกลับอัตโนมัติ', 'LINE CRM',
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    alternates: { canonical: '/' },
    icons: {
      icon: [
        { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: appName,
    },
    formatDetection: { telephone: false },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      type: 'website',
      siteName: appName,
      url: '/',
      locale: 'th_TH',
      images: [
        {
          url: '/icons/og-image.png',
          width: 1200,
          height: 630,
          alt: `${appName} — ระบบจัดการ LINE OA`,
          type: 'image/png',
        },
        {
          url: '/icons/og-image-square.png',
          width: 1200,
          height: 1200,
          alt: `${appName} Logo`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [
        {
          url: '/icons/twitter-image.png',
          width: 1200,
          height: 600,
          alt: `${appName} — ระบบจัดการ LINE OA`,
        },
      ],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f14' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning>
        {/* Theme detection — must run before first paint to avoid FOUC */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
        >{`(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark')}else{document.documentElement.setAttribute('data-theme','light')}}catch(e){}})();`}</Script>

        {/* Service worker — non-blocking, runs after hydration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
        >{`if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.log('SW registration failed:',e)})})}`}</Script>

        <TRPCProvider>
          {children}
          <Toaster richColors position="top-right" />
        </TRPCProvider>
      </body>
    </html>
  );
}


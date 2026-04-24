import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { DiscountBanner } from '@/components/DiscountBanner';

export const metadata: Metadata = {
  title: 'vinex22 — Travel, considered.',
  description: 'Premium travel essentials. Engineered for the long itinerary.'
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <DiscountBanner />
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

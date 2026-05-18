import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Collaborative List — share to-dos in real time',
  description:
    'Create a to-do list, share its URL, and collaborate live with anyone — no account required.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

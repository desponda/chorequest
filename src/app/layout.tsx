import type { Metadata, Viewport } from 'next'
import { Cinzel, Nunito } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  variable: '--font-cinzel',
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://chorequest.dresponda.com'),
  title: {
    default: 'ChoreQuest — The Family Realm',
    template: '%s — ChoreQuest',
  },
  description:
    'A fantasy quest board that makes kids compete to help around the house — with real-time family displays, coin rewards, and streak bonuses.',
  applicationName: 'ChoreQuest',
  keywords: ['chore app', 'kids chores', 'family chores', 'allowance app', 'chore chart', 'reward chart', 'gamified chores'],
  authors: [{ name: 'ChoreQuest' }],
  openGraph: {
    type: 'website',
    siteName: 'ChoreQuest',
    title: 'ChoreQuest — Turn chores into legendary quests',
    description:
      'The fantasy chore app kids actually want to use. Quest tiers, streak multipliers, family bounty board, and a live wall display.',
    url: 'https://chorequest.dresponda.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChoreQuest — Turn chores into legendary quests',
    description:
      'The fantasy chore app kids actually want to use. Live wall display, streak bonuses, real-world rewards.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#050310',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${nunito.variable} h-full`}
    >
      <body className="min-h-full">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: 'rgba(12, 8, 32, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.92)',
              fontFamily: 'var(--font-nunito), Nunito, sans-serif',
            },
          }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

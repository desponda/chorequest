import type { Metadata, Viewport } from 'next'
import { Cinzel, Nunito } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

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
  title: 'ChoreQuest — The Family Realm',
  description: 'Transform chores into epic quests for your young adventurers',
}

export const viewport: Viewport = {
  themeColor: '#050310',
  width: 'device-width',
  initialScale: 1,
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
      </body>
    </html>
  )
}

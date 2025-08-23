import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: {
    default: 'Youform Clone - Build Beautiful Forms',
    template: '%s | Youform Clone'
  },
  description: 'Create, share, and collect responses from beautiful forms. Build custom forms with drag-and-drop interface, share via public URLs, and analyze responses.',
  keywords: ['form builder', 'online forms', 'survey tool', 'form creator', 'data collection'],
  authors: [{ name: 'Youform Clone' }],
  creator: 'Youform Clone',
  publisher: 'Youform Clone',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    title: 'Youform Clone - Build Beautiful Forms',
    description: 'Create, share, and collect responses from beautiful forms.',
    siteName: 'Youform Clone',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Youform Clone - Build Beautiful Forms',
    description: 'Create, share, and collect responses from beautiful forms.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  )
}
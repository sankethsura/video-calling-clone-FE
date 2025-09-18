import type { Metadata } from 'next'
import './globals.css'
import { SocketProvider } from '@/contexts/SocketContext'

export const metadata: Metadata = {
  title: 'Video Call App',
  description: '1:1 Video calling app with WebRTC',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  )
}
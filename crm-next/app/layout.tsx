import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'KJS Creative CRM', description: 'KJS Creative CRM' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}

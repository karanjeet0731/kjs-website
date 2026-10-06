import type { Metadata } from 'next'
import './globals.css'
import CrmShell from './components/crm-shell'
export const metadata: Metadata = { title: 'KJS Creative CRM', description: 'KJS Creative CRM' }
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><CrmShell>{children}</CrmShell></body></html> }

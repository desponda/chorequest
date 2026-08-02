import { notFound } from 'next/navigation'

export default function E2eFixturesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_E2E_FIXTURES !== '1') {
    notFound()
  }

  return children
}

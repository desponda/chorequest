import type { Metadata } from 'next'
import Link from 'next/link'
import { RealmEmblem } from '@/components/ui/realm-emblem'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How ChoreQuest handles family account and app data.',
}

const sections = [
  {
    title: 'What we collect',
    body: 'When a parent creates an account, ChoreQuest stores the email address used for authentication. The app also stores the family information you enter, such as family and child display names, quest activity, rewards, coin balances, and settings. Child PINs are used for access control and are not shown in the child interface.',
  },
  {
    title: 'How we use it',
    body: 'We use this information to provide the family dashboard, kid quest boards, approvals, rewards, notifications, and invite links. We do not sell family data or use it to build advertising profiles.',
  },
  {
    title: 'Service providers',
    body: 'ChoreQuest uses Supabase for authentication and database hosting, Vercel for application hosting and performance measurement, and Sentry when error monitoring is configured. These providers process data only to operate and secure the service.',
  },
  {
    title: 'Children’s privacy',
    body: 'ChoreQuest is designed for a parent-managed family account. Parents control the information entered for children and should use display names rather than sensitive personal details. The service is not intended for children to create independent accounts.',
  },
  {
    title: 'Retention and deletion',
    body: 'Data remains associated with your family account while you use the service. You can request account and family-data deletion through the support contact associated with your account. We may retain limited records where required for security, fraud prevention, or legal obligations.',
  },
  {
    title: 'Changes',
    body: 'We may update this policy as the product changes. Material changes will be reflected on this page with a new effective date.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen cq-page-shell px-4 py-8 sm:py-12">
      <div className="relative z-10 max-w-3xl mx-auto">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-white/60 hover:text-white/90 transition-colors">
          ← Back to ChoreQuest
        </Link>
        <header className="mt-10 mb-10">
          <div className="inline-flex items-center gap-3 text-cq-gold mb-5" aria-hidden="true">
            <RealmEmblem name="shield" size={34} />
            <span className="font-heading font-bold tracking-widest text-white/70">ChoreQuest</span>
          </div>
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/50 mb-3">Trust & privacy</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-gradient-gold tracking-wide mb-4">Privacy policy</h1>
          <p className="text-white/60 leading-relaxed">Effective September 5, 2026. This plain-language policy explains the data ChoreQuest needs to run a family realm.</p>
        </header>
        <div className="flex flex-col gap-4">
          {sections.map(section => (
            <section key={section.title} className="rounded-2xl p-6 sm:p-7" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <h2 className="font-heading text-lg font-bold text-white/90 mb-2">{section.title}</h2>
              <p className="text-white/65 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
        <footer className="mt-10 pt-6 border-t border-white/10 text-sm text-white/50">
          <Link href="/terms" className="text-cq-gold hover:text-cq-gold/80 transition-colors">Terms of service</Link>
        </footer>
      </div>
    </main>
  )
}

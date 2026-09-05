import type { Metadata } from 'next'
import Link from 'next/link'
import { RealmEmblem } from '@/components/ui/realm-emblem'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for using ChoreQuest.',
}

const sections = [
  {
    title: 'Using ChoreQuest',
    body: 'ChoreQuest helps families organize responsibilities, approvals, and rewards. You are responsible for the account you create, the information you enter, and keeping your sign-in credentials and family invite links secure.',
  },
  {
    title: 'Family data and child access',
    body: 'Parents and guardians should decide what information is appropriate to enter for children. Do not add sensitive personal information to quest, reward, or profile fields. Share kid PINs and invite links only with the people who should use them.',
  },
  {
    title: 'Acceptable use',
    body: 'Do not use ChoreQuest to abuse, attack, probe, or disrupt the service; attempt to access another family’s data; bypass plan limits; or upload unlawful, harmful, or infringing content.',
  },
  {
    title: 'Plans and future billing',
    body: 'The free experience is available as described on the public site. Paid plans may be introduced later. No payment is currently collected through ChoreQuest, and paid features will not be activated until the relevant billing flow is available.',
  },
  {
    title: 'Availability and changes',
    body: 'We work to keep the service available and secure, but interruptions can happen during maintenance, provider incidents, or circumstances outside our control. Features and these terms may change as ChoreQuest develops.',
  },
  {
    title: 'Account closure',
    body: 'You may stop using your account at any time. We may restrict or close accounts that violate these terms or threaten the security of other users. Requests about account or family-data deletion should be made through the support contact associated with your account.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen cq-page-shell px-4 py-8 sm:py-12">
      <div className="relative z-10 max-w-3xl mx-auto">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-white/60 hover:text-white/90 transition-colors">
          ← Back to ChoreQuest
        </Link>
        <header className="mt-10 mb-10">
          <div className="inline-flex items-center gap-3 text-cq-gold mb-5" aria-hidden="true">
            <RealmEmblem name="scroll" size={34} />
            <span className="font-heading font-bold tracking-widest text-white/70">ChoreQuest</span>
          </div>
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/50 mb-3">The fine print</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-black text-gradient-gold tracking-wide mb-4">Terms of service</h1>
          <p className="text-white/60 leading-relaxed">Effective September 5, 2026. These terms keep the family realm safe and understandable.</p>
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
          <Link href="/privacy" className="text-cq-gold hover:text-cq-gold/80 transition-colors">Privacy policy</Link>
        </footer>
      </div>
    </main>
  )
}

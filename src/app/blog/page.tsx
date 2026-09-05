import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RealmIcon } from '@/components/ui/realm-icon'

export const metadata: Metadata = {
  title: 'Blog — ChoreQuest',
  description: 'Insights on chore science, kid motivation, reward psychology, and raising responsible children — from the ChoreQuest team.',
  openGraph: {
    title: 'Blog — ChoreQuest',
    description: 'Insights on chore science, kid motivation, and raising responsible children.',
    type: 'website',
  },
}

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  body: string
}

function readingTime(body: string): string {
  const words = body.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 200))
  return `${minutes} min read`
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function BlogListingPage() {
  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, title, excerpt, cover_url, published_at, body')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(50)

  const articles = (posts ?? []) as Post[]

  return (
    <div className="min-h-screen cq-page-shell text-white">

      {/* Nav */}
      <header
        className="safe-top sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 pb-3 sm:pb-4 gap-3"
        style={{ background: 'rgba(5,3,16,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <span className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}><RealmIcon name="⚔️" size={17} /></span>
          <span className="font-heading font-bold text-base sm:text-lg tracking-widest text-white/90 truncate">ChoreQuest</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6 text-sm text-white/45">
          <Link href="/" className="hidden sm:block hover:text-white/80 transition-colors">Home</Link>
          <Link href="/#features" className="hidden sm:block hover:text-white/80 transition-colors">Features</Link>
          <Link href="/blog" className="text-white/80 font-medium hidden sm:block">Blog</Link>
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center px-3 sm:px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap text-sm"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Header */}
        <div className="mb-14">
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30 mb-3">ChoreQuest Blog</p>
          <h1 className="font-heading text-4xl sm:text-6xl font-bold text-white/90 leading-tight">
            Raising<br />
            <span style={{ color: '#fbbf24' }}>Responsible</span> Kids
          </h1>
          <p className="text-white/45 mt-4 max-w-lg text-lg">
            Chore science, reward psychology, and practical guides for families building better habits together.
          </p>
        </div>

        {/* Posts */}
        {articles.length === 0 ? (
          <div
            className="rounded-2xl p-7 sm:p-12 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}><RealmIcon name="📜" size={28} /></span>
            <p className="font-heading text-xl text-white/60 mb-2">The scrolls are being written</p>
            <p className="text-white/30 text-sm">Articles coming soon — check back shortly.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {articles.map((post, i) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block rounded-2xl overflow-hidden transition-all hover:scale-[1.01]"
                style={{
                  background: i === 0 ? 'rgba(251,191,36,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                <div className="flex flex-col sm:flex-row gap-0">
                  {/* Cover image */}
                  {post.cover_url && (
                    <div
                      className="sm:w-48 sm:flex-shrink-0 h-48 sm:h-auto bg-cover bg-center"
                      style={{ backgroundImage: `url(${post.cover_url})` }}
                    />
                  )}
                  <div className="p-7 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center gap-3 mb-3 text-xs text-white/30">
                        {post.published_at && <span>{formatDate(post.published_at)}</span>}
                        <span>·</span>
                        <span>{readingTime(post.body)}</span>
                      </div>
                      <h2 className="font-heading text-xl sm:text-2xl font-bold text-white/90 mb-3 group-hover:text-cq-gold transition-colors leading-snug">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="text-white/45 text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
                      )}
                    </div>
                    <p className="mt-4 text-sm font-semibold" style={{ color: '#fbbf24' }}>
                      Read article →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer
        className="relative z-10 py-10 px-6 text-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link href="/" className="min-h-11 inline-flex items-center rounded-xl px-3 text-white/55 text-sm hover:text-white/90 transition-colors">
          ← Back to ChoreQuest
        </Link>
      </footer>
    </div>
  )
}

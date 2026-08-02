import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/server'
import { StarField } from '@/components/star-field'

type Props = { params: Promise<{ slug: string }> }

type Source = { title: string; url?: string; authors?: string; year?: number }

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string
  cover_url: string | null
  sources: Source[]
  published_at: string | null
}

async function getPost(slug: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('id, slug, title, excerpt, body, cover_url, sources, published_at')
    .eq('slug', slug)
    .eq('published', true)
    .single()
  return data as Post | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Not found — ChoreQuest' }

  const description = post.excerpt ?? post.body.slice(0, 160)
  return {
    title: `${post.title} — ChoreQuest Blog`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      ...(post.cover_url ? { images: [{ url: post.cover_url }] } : {}),
    },
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function readingTime(body: string): string {
  const minutes = Math.max(1, Math.round(body.trim().split(/\s+/).length / 200))
  return `${minutes} min read`
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const sources = Array.isArray(post.sources) ? post.sources : []

  return (
    <div className="min-h-screen bg-quest-void text-white">
      <StarField />

      {/* Nav */}
      <header
        className="safe-top sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 pb-3 sm:pb-4 gap-3"
        style={{ background: 'rgba(5,3,16,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">⚔️</span>
          <span className="font-heading font-bold text-base sm:text-lg tracking-widest text-white/90 truncate">ChoreQuest</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/blog" className="min-h-11 inline-flex items-center rounded-lg px-2 text-sm text-white/60 hover:text-white/90 transition-colors whitespace-nowrap">← All posts</Link>
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Cover image */}
        {post.cover_url && (
          <div
            className="w-full h-64 rounded-2xl bg-cover bg-center mb-10"
            style={{ backgroundImage: `url(${post.cover_url})` }}
            role="img"
            aria-label={`Cover image for ${post.title}`}
          />
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-white/30 mb-6">
          {post.published_at && <span>{formatDate(post.published_at)}</span>}
          <span>·</span>
          <span>{readingTime(post.body)}</span>
        </div>

        {/* Title */}
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white/95 leading-tight mb-6">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-white/55 text-xl leading-relaxed mb-10 border-l-2 pl-4"
            style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
            {post.excerpt}
          </p>
        )}

        {/* Body — markdown */}
        <div className="prose-blog">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="font-heading text-3xl font-bold text-white/90 mt-10 mb-4">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="font-heading text-2xl font-bold text-white/85 mt-8 mb-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-heading text-xl font-bold text-white/80 mt-6 mb-2">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-white/65 leading-relaxed mb-5 text-base">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="text-white/65 mb-5 pl-5 flex flex-col gap-1.5 list-disc marker:text-cq-gold/50">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="text-white/65 mb-5 pl-5 flex flex-col gap-1.5 list-decimal marker:text-cq-gold/50">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="text-white/90 font-semibold">{children}</strong>,
              em: ({ children }) => <em className="text-white/70 italic">{children}</em>,
              blockquote: ({ children }) => (
                <blockquote
                  className="my-6 pl-5 py-1 italic"
                  style={{ borderLeft: '3px solid rgba(251,191,36,0.4)', color: 'rgba(255,255,255,0.55)' }}
                >
                  {children}
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                return isBlock ? (
                  <code
                    className="block p-4 rounded-xl text-sm font-mono mb-5 overflow-x-auto"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#4ade80', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {children}
                  </code>
                ) : (
                  <code
                    className="px-1.5 py-0.5 rounded text-xs font-mono"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#38bdf8' }}
                  >
                    {children}
                  </code>
                )
              },
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 transition-colors"
                  style={{ color: '#fbbf24' }}
                >
                  {children}
                </a>
              ),
              hr: () => (
                <hr className="my-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              ),
            }}
          >
            {post.body}
          </ReactMarkdown>
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div
            className="mt-12 rounded-2xl p-6"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white/35 mb-4">Sources</h2>
            <ol className="flex flex-col gap-3">
              {sources.map((src, i) => (
                <li key={i} className="text-sm text-white/45 flex gap-3">
                  <span className="text-white/20 flex-shrink-0">{i + 1}.</span>
                  <span>
                    {src.authors && <span>{src.authors}. </span>}
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cq-gold/60 hover:text-cq-gold/90 underline underline-offset-2 transition-colors"
                      >
                        {src.title}
                      </a>
                    ) : (
                      <span className="text-white/55">{src.title}</span>
                    )}
                    {src.year && <span className="text-white/30"> ({src.year})</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Back link + CTA */}
        <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href="/blog" className="min-h-11 inline-flex items-center rounded-xl px-2 text-sm text-white/60 hover:text-white/90 transition-colors">
            ← All articles
          </Link>
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.3)',
              color: '#fbbf24',
            }}
          >
            Try ChoreQuest free →
          </Link>
        </div>
      </main>
    </div>
  )
}

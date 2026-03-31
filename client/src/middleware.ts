import { NextRequest, NextResponse } from 'next/server'

// All known social/link-preview bot user agents
const BOT_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Applebot|Slackbot|vkShare|W3C_Validator|redditbot|Googlebot|bingbot|DuckDuckBot|YandexBot|Baiduspider|Sogou|Exabot|ia_archiver/i

export const config = {
  matcher: ['/inventory/:id*'],
}

export async function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  const pathname = req.nextUrl.pathname

  // Only match /inventory/[id] (not sub-paths)
  const match = pathname.match(/^\/inventory\/([a-zA-Z0-9_-]+)$/)
  if (!match) return NextResponse.next()

  const id = match[1]
  if (!id) return NextResponse.next()

  // Only intercept known link-preview bots
  if (!BOT_PATTERN.test(ua)) return NextResponse.next()

  // Rewrite bot requests to the OG API endpoint
  return NextResponse.rewrite(new URL(`/api/og/${id}`, req.url))
}

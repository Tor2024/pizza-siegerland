import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that require admin auth
const PROTECTED_PATHS = [
  '/api/admin',
  '/admin'
];

// Paths that need rate limiting
const RATE_LIMITED_PATHS = [
  '/api/orders',
  '/api/menu'
];

// In-memory rate limit store (note: this won't persist across serverless invocations)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max 30 requests per minute per IP

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

function isRateLimitedPath(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some(path => pathname.startsWith(path));
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimit.get(ip);
  if (!record || now > record.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting for API endpoints
  if (isRateLimitedPath(pathname)) {
    const ip = getClientIP(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
  }

  // Check admin auth for protected paths
  if (isProtectedPath(pathname)) {
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      // For page routes, redirect to login
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/admin/:path*',
    '/api/orders/:path*',
    '/api/menu/:path*'
  ]
};
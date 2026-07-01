# Deployment Guide - BillAI Admin Dashboard

## 🚀 Quick Start

### Development Server

```bash
cd ai-bill-admin
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## 📦 Deployment Options

### 1. Vercel (Recommended)

The easiest way to deploy your Next.js app.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### 2. Netlify

```bash
# Build command
npm run build

# Publish directory
.next
```

### 3. Docker

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t billai-admin .
docker run -p 3000:3000 billai-admin
```

### 4. AWS (EC2 / Elastic Beanstalk)

```bash
# Build the application
npm run build

# Start with PM2
npm install -g pm2
pm2 start npm --name "billai-admin" -- start
pm2 save
pm2 startup
```

### 5. DigitalOcean App Platform

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set run command: `npm start`
4. Deploy

## 🔧 Environment Variables

Create a `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_KEY=your_api_key_here

# Authentication
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your_secret_here

# Database (if needed)
DATABASE_URL=postgresql://user:password@host:5432/database

# Storage
STORAGE_BUCKET=your_bucket_name
STORAGE_REGION=us-east-1

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

## 📊 Performance Optimization

### 1. Enable Compression

Add to `next.config.js`:

```javascript
module.exports = {
  compress: true,
}
```

### 2. Image Optimization

Images are automatically optimized by Next.js. Use the `Image` component:

```jsx
import Image from 'next/image'

<Image src="/logo.png" width={200} height={200} alt="Logo" />
```

### 3. Caching Strategy

Configure caching headers in `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}
```

## 🔒 Security Best Practices

### 1. Environment Variables

Never commit `.env.local` to version control. Add to `.gitignore`:

```
.env*.local
```

### 2. Security Headers

Add security headers in `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
        ],
      },
    ]
  },
}
```

### 3. API Routes Protection

Implement authentication middleware for API routes.

## 📈 Monitoring

### 1. Vercel Analytics

Add to `app/layout.tsx`:

```jsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 2. Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
```

Configure in `sentry.client.config.js` and `sentry.server.config.js`.

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID}}
          vercel-project-id: ${{ secrets.PROJECT_ID}}
```

## 🌐 Custom Domain

### Vercel

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Cloudflare

1. Add your domain to Cloudflare
2. Update nameservers
3. Configure SSL/TLS to "Full"
4. Enable "Always Use HTTPS"

## 📱 PWA Configuration (Optional)

Install next-pwa:

```bash
npm install next-pwa
```

Configure in `next.config.js`:

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
})

module.exports = withPWA({
  // your next config
})
```

## 🧪 Testing Before Deployment

```bash
# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Build test
npm run build

# Start production server locally
npm start
```

## 📊 Performance Checklist

- [ ] Enable compression
- [ ] Optimize images
- [ ] Minimize JavaScript bundles
- [ ] Enable caching
- [ ] Use CDN for static assets
- [ ] Implement lazy loading
- [ ] Add loading states
- [ ] Optimize fonts
- [ ] Remove unused dependencies
- [ ] Enable HTTP/2

## 🔍 SEO Optimization

Add metadata in `app/layout.tsx`:

```jsx
export const metadata = {
  title: 'BillAI - AI-Powered Invoice Management',
  description: 'Enterprise-grade AI invoice management admin dashboard',
  keywords: ['invoice', 'AI', 'OCR', 'management', 'dashboard'],
  authors: [{ name: 'Your Company' }],
  openGraph: {
    title: 'BillAI Admin Dashboard',
    description: 'Manage invoices with AI-powered automation',
    images: ['/og-image.png'],
  },
}
```

## 🆘 Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next
npm run build
```

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📞 Support

For deployment issues:
- Check Next.js documentation: https://nextjs.org/docs
- Vercel support: https://vercel.com/support
- GitHub Issues: Create an issue in your repository

---

**Last Updated:** 2024
**Next.js Version:** 14+
**Node Version:** 20+

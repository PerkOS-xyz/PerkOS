# PerkOS Marketing Site

Marketing landing page for PerkOS - The Operating System for AI Agents.

## Overview

This is the official marketing website for PerkOS, showcasing both **Spark** (no-code agent launcher) and **Stack** (agent infrastructure middleware).

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Language**: TypeScript
- **Package Manager**: npm

## Project Structure

```
perkos-site/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main landing page
│   └── globals.css         # Global styles
├── components/
│   └── ui/                 # shadcn/ui components
│       ├── button.tsx
│       └── card.tsx
├── public/
│   └── images/            # Product logos and icons
│       ├── PerkOS.png
│       ├── PerkOS-icon.png
│       ├── Spark.png
│       ├── Spark-icon.png
│       ├── Stack.png
│       └── Stack-icon.png
└── lib/
    └── utils.ts           # Utility functions
```

## Features

### Landing Page Sections

1. **Header** - Sticky navigation with product links
2. **Hero** - Main value proposition with CTAs
3. **Product Showcase** - Spark and Stack feature cards
4. **Features Grid** - 6 key features (x402, ERC-8004, Discovery, etc.)
5. **Pricing** - Transparent pricing for both products
6. **CTA** - Call to action with GitHub links
7. **Footer** - Links and company information

### Design System

**Colors:**
- Spark: Orange (\`#f59e0b\`) - Energetic, community-focused
- Stack: Blue (\`#3b82f6\`) - Professional, infrastructure-focused

**Typography:**
- Headings: Geist Sans (bold)
- Body: Geist Sans (regular)
- Code: Geist Mono

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

### Development Server

Open [http://localhost:3000](http://localhost:3000) to view the site.

The page auto-updates as you edit files.

## Content Source

All content is sourced from:
- \`/Docs/PERKOS-MARKETING-GUIDE.md\` - Complete brand and marketing strategy
- \`/README.md\` - Technical documentation and architecture

## Links

- **Main Repository**: https://github.com/PerkOS-xyz/PerkOS
- **Spark Repository**: https://github.com/PerkOS-xyz/Spark
- **Stack Repository**: https://github.com/PerkOS-xyz/Stack
- **Twitter**: [@PerkOS_xyz](https://twitter.com/PerkOS_xyz)

## Deployment

### Vercel (Recommended)

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
\`\`\`

### Manual Deployment

\`\`\`bash
# Build
npm run build

# Output directory: .next/
# Deploy the .next directory to your hosting provider
\`\`\`

## SEO & Metadata

The site includes comprehensive metadata for SEO:
- Open Graph tags for social sharing
- Twitter Card tags
- Structured keywords
- Semantic HTML

## License

© 2024 PerkOS. All rights reserved.

---

**Spark ignites. Stack powers.**

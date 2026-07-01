# BillVault AI - AI-Powered Invoice Management Admin Dashboard

A world-class, enterprise-grade admin dashboard for AI-powered bill and invoice management. Built with Next.js, TypeScript, Tailwind CSS, and modern UI libraries.

## 🚀 Features

### Core Functionality
- **Dashboard Overview** - Real-time KPIs, analytics, and system health
- **User Management** - Comprehensive user administration with usage tracking
- **OCR Processing Monitor** - Live invoice processing with AI confidence scores
- **AI Extraction Analytics** - Deep insights into AI model performance
- **Subscription Management** - Revenue analytics and plan management
- **System Health** - Infrastructure monitoring and performance metrics

### Design Features
- 🎨 **Premium Dark UI** - Futuristic glassmorphism design
- ✨ **Smooth Animations** - Framer Motion powered interactions
- 📊 **Advanced Charts** - Recharts with custom gradients
- 🎯 **AI-Native Experience** - Real-time processing visualizations
- 📱 **Fully Responsive** - Optimized for all devices
- 🌈 **Gradient Accents** - Emerald, teal, and neon highlights

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui + Radix UI
- **Animations:** Framer Motion
- **Charts:** Recharts
- **State Management:** Zustand
- **Date Handling:** date-fns

## 📦 Installation

```bash
# Navigate to project directory
cd ai-bill-admin

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📁 Project Structure

```
ai-bill-admin/
├── app/
│   ├── page.tsx                 # Main Dashboard
│   ├── users/page.tsx           # User Management
│   ├── ocr/page.tsx             # OCR Processing
│   ├── ai-extraction/page.tsx   # AI Analytics
│   ├── system/page.tsx          # System Health
│   ├── subscriptions/page.tsx   # Subscription Plans
│   ├── layout.tsx               # Root Layout
│   └── globals.css              # Global Styles
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── Sidebar.tsx              # Navigation Sidebar
│   ├── Header.tsx               # Top Header
│   └── KPICard.tsx              # KPI Card Component
├── store/
│   └── useStore.ts              # Zustand State Management
└── lib/
    └── utils.ts                 # Utility Functions
```

## 🎨 Key Pages

### 1. Dashboard (`/`)
- 8 KPI cards with animated counters
- Invoice processing trends
- Revenue analytics
- AI accuracy metrics
- Real-time activity feed

### 2. User Management (`/users`)
- Enterprise user table
- Search and filter functionality
- User statistics and analytics
- Plan-based badges
- Action controls

### 3. OCR Processing (`/ocr`)
- Live processing queue
- Confidence score visualization
- Field extraction progress
- Status indicators (Processing, Success, Failed, Review)
- AI scan animations

### 4. AI Extraction (`/ai-extraction`)
- Field-level accuracy metrics
- Performance trends over time
- Document type analytics
- AI capabilities radar chart
- Confidence tracking

### 5. System Health (`/system`)
- CPU and memory monitoring
- API endpoint performance
- System alerts and notifications
- Real-time metrics
- Infrastructure health

### 6. Subscriptions (`/subscriptions`)
- Pricing plan cards
- Revenue growth charts
- Conversion analytics
- User distribution
- Plan management

## 🎯 Design Philosophy

### Color System
- **Primary:** Emerald (#10b981) & Teal (#14b8a6)
- **Background:** Deep Black (#0f172a) & Graphite (#1e293b)
- **Accents:** Cyan, Purple, Pink gradients
- **Status:** Green (success), Amber (warning), Red (error), Cyan (processing)

### UI Principles
- Glassmorphism cards with backdrop blur
- Smooth hover effects and transitions
- Animated charts and counters
- AI-inspired glow effects
- Enterprise-grade data tables
- Responsive grid layouts

## 🔧 Customization

### Adding New Pages
1. Create a new page in `app/[page-name]/page.tsx`
2. Add route to `components/Sidebar.tsx`
3. Use existing components and patterns

### Modifying Colors
Update gradient colors in component files or create new variants in `tailwind.config.ts`

### Adding Charts
Use Recharts components with custom gradients and styling to match the design system

## 📊 Data Integration

Currently uses mock data. To integrate with real APIs:

1. Create API routes in `app/api/`
2. Use React Query for data fetching
3. Update components to consume real data
4. Add loading and error states

## 🚀 Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

Deploy to Vercel, Netlify, or any Node.js hosting platform.

## 🎭 Features Showcase

- ✅ Animated KPI cards with trend indicators
- ✅ Real-time OCR processing visualization
- ✅ AI confidence score tracking
- ✅ Interactive charts and graphs
- ✅ Collapsible sidebar navigation
- ✅ Search and filter functionality
- ✅ Status badges and indicators
- ✅ Responsive design
- ✅ Dark mode optimized
- ✅ Smooth page transitions

## 📝 License

This project is created for demonstration purposes.

## 🤝 Contributing

This is a showcase project. Feel free to fork and customize for your needs.

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS

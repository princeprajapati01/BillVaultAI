# 🚀 Quick Start Guide - AI Bill Vault

Get your AI Bill Management app running in 5 minutes!

## 📋 Prerequisites

Before you begin, ensure you have:
- ✅ Node.js 18 or higher installed
- ✅ npm or yarn package manager
- ✅ A code editor (VS Code recommended)

## 🎯 Step-by-Step Setup

### 1️⃣ Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

This will install all required packages:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Lucide React

### 2️⃣ Start Development Server

```bash
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

### 3️⃣ Open in Browser

Navigate to: **http://localhost:3000**

You'll be automatically redirected to the splash screen!

## 🎨 Screen Flow

The app follows this navigation flow:

```
Splash Screen (3s auto-redirect)
    ↓
Login/Signup
    ↓
Dashboard (Main Hub)
    ├── Upload Bill → AI Processing → Bill Detail
    ├── Bill History → Bill Detail
    └── Profile → Feedback
```

## 🧭 Navigation Guide

### From Dashboard:
- **➕ FAB Button** (bottom right) → Upload new bill
- **Recent Bills** → Click any bill to view details
- **View All** → Go to bill history
- **Profile Icon** (top right) → User profile
- **Bottom Nav** → Quick navigation

### Key Features to Test:

1. **Upload Flow**
   - Click the floating + button
   - Upload an image (or use drag & drop)
   - Watch the AI processing animation
   - View extracted data

2. **Dashboard**
   - View spending analytics
   - Check category breakdown
   - Read AI insights
   - Browse recent bills

3. **Bill History**
   - Search bills
   - Filter by category/status
   - View all transactions

4. **Profile**
   - Check usage stats
   - View premium features
   - Access settings

## 🎨 Customization Quick Tips

### Change Primary Color

Edit `tailwind.config.ts`:
```typescript
colors: {
  primary: {
    500: '#YOUR_COLOR', // Change this
  }
}
```

### Modify Mock Data

Edit the data in each page file:
```typescript
// app/dashboard/page.tsx
const recentBills = [
  // Add your data here
]
```

### Add New Routes

Create a new folder in `app/`:
```
app/
  └── your-route/
      └── page.tsx
```

## 🔧 Common Commands

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## 📱 Mobile Testing

### Test on Your Phone:

1. Find your computer's local IP:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. On your phone's browser, visit:
   ```
   http://YOUR_IP:3000
   ```

3. For best experience, add to home screen!

## 🎭 Features to Explore

### ✨ Animations
- Splash screen loading
- AI scanning effects
- Page transitions
- Micro-interactions
- Chart animations

### 🎨 UI Components
- Glassmorphism cards
- Gradient buttons
- Floating action button
- Bottom navigation
- Search & filters
- Premium upgrade card

### 📊 Data Visualization
- Bar charts (monthly spending)
- Pie charts (category breakdown)
- Progress bars (usage tracking)
- Stat cards with icons

## 🐛 Troubleshooting

### Port Already in Use?
```bash
# Use a different port
npm run dev -- -p 3001
```

### Dependencies Not Installing?
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Errors?
```bash
# Clean Next.js cache
rm -rf .next
npm run dev
```

## 🎯 Next Steps

1. **Explore All Screens** - Navigate through every page
2. **Test Interactions** - Click buttons, try animations
3. **Customize Design** - Change colors, fonts, layouts
4. **Add Backend** - Integrate with your API
5. **Deploy** - Host on Vercel, Netlify, or your platform

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Recharts](https://recharts.org/)

## 💡 Pro Tips

1. **Hot Reload** - Changes auto-refresh in dev mode
2. **Component Inspector** - Use React DevTools
3. **Tailwind IntelliSense** - Install VS Code extension
4. **Mobile First** - Always test mobile view first
5. **Performance** - Use Lighthouse for optimization

## 🎉 You're Ready!

Your AI Bill Vault is now running. Start exploring and customizing!

Need help? Check the main README.md for detailed documentation.

---

**Happy Coding! 🚀**

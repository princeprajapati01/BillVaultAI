# 🚀 AI Bill Vault - Smart Bill Management App

A modern, premium AI-powered mobile application for intelligent invoice and bill management. Built with Next.js, React, TypeScript, Tailwind CSS, and Framer Motion.

![AI Bill Vault](https://img.shields.io/badge/AI-Bill%20Vault-14b8a6?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)

## ✨ Features

### 🎨 Premium UI/UX Design
- **Modern Fintech Aesthetic** - Inspired by Stripe, Revolut, and Linear
- **Glassmorphism & Neumorphism** - Subtle depth and premium feel
- **Smooth Animations** - Powered by Framer Motion
- **Gradient Accents** - Emerald green and cyan color palette
- **Dark Mode Ready** - Full dark mode support

### 🤖 AI-Powered Features
- **Smart OCR Extraction** - Automatic data extraction from invoices
- **Real-time Processing** - Live AI scanning animations
- **Confidence Scoring** - AI accuracy indicators
- **Intelligent Categorization** - Auto-categorize expenses
- **Semantic Analysis** - Advanced field detection

### 📱 Core Screens

1. **Splash Screen** - Animated AI scan effect with floating invoice cards
2. **Login/Signup** - Glassmorphic design with social login support
3. **Dashboard** - Premium analytics with charts and insights
4. **Upload Bill** - Drag & drop with live camera scanner
5. **AI Processing** - Cinematic OCR extraction visualization
6. **Bill Detail** - Comprehensive bill view with edit capabilities
7. **Bill History** - Searchable timeline with advanced filters
8. **Profile** - Account management with premium upgrade
9. **Feedback** - AI support assistant with rating system

### 📊 Dashboard Features
- Total bills counter
- Monthly spending tracker
- GST summary
- AI processing success rate
- Interactive charts (Bar & Pie)
- Recent bills list
- AI-powered insights

### 🎯 User Experience
- **Mobile-First Design** - Optimized for mobile devices
- **Gesture-Friendly** - Swipe actions and smooth interactions
- **Bottom Navigation** - Easy thumb-zone navigation
- **Floating Action Button** - Quick bill upload access
- **Micro-Animations** - Delightful interaction feedback
- **Loading States** - Shimmer effects and skeleton screens

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **Utilities**: clsx, tailwind-merge

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd ai-bill-vault
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Run the development server**
```bash
npm run dev
# or
yarn dev
```

4. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
ai-bill-vault/
├── app/
│   ├── splash/          # Splash screen
│   ├── login/           # Authentication
│   ├── dashboard/       # Main dashboard
│   ├── upload/          # Bill upload
│   ├── processing/      # AI processing
│   ├── bill/[id]/       # Bill details
│   ├── history/         # Bill history
│   ├── profile/         # User profile
│   ├── feedback/        # Feedback form
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home redirect
│   └── globals.css      # Global styles
├── public/              # Static assets
├── tailwind.config.ts   # Tailwind configuration
├── tsconfig.json        # TypeScript config
└── package.json         # Dependencies
```

## 🎨 Design System

### Color Palette

**Primary (Emerald/Teal)**
- `primary-50` to `primary-900`
- Gradient: `#0d9488` → `#14b8a6` → `#2dd4bf`

**Accent Colors**
- Cyan: `#06b6d4` → `#3b82f6`
- Purple: `#667eea` → `#764ba2`

### Typography
- Font: Inter (sans-serif)
- Headings: Bold, spacious
- Body: Regular, readable

### Shadows & Effects
- `shadow-glow` - Emerald glow effect
- `shadow-premium` - Soft depth shadow
- `glass` - Glassmorphism backdrop
- `shimmer` - Loading animation

## 🔧 Customization

### Modify Colors
Edit `tailwind.config.ts`:
```typescript
colors: {
  primary: {
    500: '#14b8a6', // Your color
    // ...
  }
}
```

### Add New Screens
Create a new folder in `app/`:
```typescript
// app/new-screen/page.tsx
export default function NewScreen() {
  return <div>New Screen</div>
}
```

### Customize Animations
Edit animation values in `tailwind.config.ts`:
```typescript
animation: {
  'custom': 'custom 2s ease-in-out infinite',
}
```

## 📱 Responsive Design

The app is fully responsive with breakpoints:
- Mobile: `< 640px`
- Tablet: `640px - 1024px`
- Desktop: `> 1024px`

## 🎭 Animation Features

- **Page Transitions** - Smooth enter/exit animations
- **Micro-interactions** - Button hover and tap effects
- **Loading States** - Skeleton screens and shimmers
- **Scroll Animations** - Parallax and reveal effects
- **AI Scanning** - Beam and bounding box animations

## 🔐 Security Notes

This is a **frontend demo** application. For production:
- Implement proper authentication (JWT, OAuth)
- Add backend API integration
- Secure file uploads
- Implement rate limiting
- Add input validation
- Use environment variables for secrets

## 🚧 Future Enhancements

- [ ] Backend API integration
- [ ] Real OCR implementation
- [ ] Payment gateway integration
- [ ] Export to accounting software
- [ ] Team collaboration features
- [ ] Mobile app (React Native)
- [ ] Offline support (PWA)
- [ ] Multi-language support

## 📄 License

This project is for demonstration purposes. Modify as needed for your use case.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For questions or support, contact: support@aibillvault.com

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**

🌟 **Star this repo if you find it useful!**

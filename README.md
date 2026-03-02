<<<<<<< HEAD
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
=======
````markdown
# MSKAesthetics

A secure, modern operations dashboard built to help a growing aesthetics business manage inventory, quotes, sales, and restocks — all in one place.

MSKAesthetics replaces spreadsheet chaos with a clean, reliable workflow powered by real-time data, strong access control, and a fast, scalable tech stack.

---

## 🚀 Overview

MSKAesthetics is an internal web application designed for product-based businesses that need:

- Real-time inventory visibility
- Controlled user access
- Clean sales and restock workflows
- Organized quote tracking
- Performance analytics

# MSKAesthetics

A secure, modern operations dashboard built to help a growing aesthetics business manage inventory, quotes, sales, and restocks — all in one place.

MSKAesthetics replaces spreadsheet chaos with a clean, reliable workflow powered by real-time data, strong access control, and a fast, scalable tech stack.

---

## 🚀 Overview

MSKAesthetics is an internal web application designed for product-based businesses that need:

- Real-time inventory visibility
- Controlled user access
- Clean sales and restock workflows
- Organized quote tracking
- Performance analytics

Built with performance, security, and scalability in mind.

---

## ✨ Features

### 🔐 Authentication & Security

- Supabase Auth integration
- Secure login & session handling
- Protected routes
- Role-based access control
- Row Level Security (RLS) policies
- Users only see the data they are allowed to see

### 📦 Inventory Management

- Centralized product management
- Live stock tracking
- Low stock visibility
- Stock adjustments via sales & restocks

### 💰 Sales Management

- Streamlined "Add Sale" flow
- Automatic stock deduction
- Sales history tracking
- Clean and intuitive sales interface

### 🧾 Quotes Tracking

- Create and manage quotes
- Organized client pricing
- Follow-up visibility
- Quote-to-sale tracking potential

### 🔄 Restock Workflows

- Add restock entries
- Automatic quantity updates
- Restock history logging

### 📊 Analytics Dashboard

- Sales performance snapshots
- Inventory insights
- Trend visibility
- Business decision support

### 👥 User Management

- Role-based permissions (Admin / Manager / Staff)
- Secure onboarding & offboarding
- Controlled data visibility

---

## 🛠 Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Modern component architecture
- Clean state management

### Backend / Database

- Supabase
- PostgreSQL
- Row Level Security (RLS)
- Database migrations
- Triggers for stock automation
- Real-time subscriptions

---

## 🏗 Architecture Highlights

- Postgres as the single source of truth
- RLS policies enforcing access at the database level
- Triggers handling automatic stock updates
- Real-time listeners for live UI updates
- Strict TypeScript typing for reliability

---

## 📂 Core Modules

- Authentication
- Dashboard
- Products
- Sales
- Restocks
- Quotes
- Users
- Analytics

---

## 🔒 Security Model

- All tables protected with RLS
- Policies based on user roles
- No direct client-side trust
- Access enforced at database level

---

## ⚙️ Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 🧪 Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📈 Why MSKAesthetics?

- Eliminates spreadsheet dependency
- Reduces stock errors
- Improves operational clarity
- Enables faster decision-making
- Secure and scalable foundation

---

## 🎯 Ideal For

- Aesthetics clinics
- Beauty brands
- Product-based small businesses
- Growing teams needing operational structure

---

## 📬 Contact

If you're running a product-based business and want a secure, tailored internal operations system, feel free to connect.

---

## 🏷 Tags

React · TypeScript · Supabase · PostgreSQL · Inventory Management · Analytics · Small Business Tech

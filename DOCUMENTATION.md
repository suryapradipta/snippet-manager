# Echo Snippet Manager - Technical Documentation

Echo is a high-performance, minimalist code snippet manager designed for productivity. It features a native-feeling glassmorphism UI, global hotkey activation, and real-time cloud synchronization via Supabase.

## 🏗 Architecture Overview

- **Frontend**: Built with [Vite](https://vitejs.dev/) and [TypeScript](https://www.typescriptlang.org/).
- **Native Layer**: Powered by [Electron](https://www.electronjs.org/) for system-level integration (global hotkeys, clipboard interaction).
- **Styling**: Vanilla CSS for core UI components with a glassmorphism aesthetic. The landing page uses [Tailwind CSS](https://tailwindcss.com/).
- **Database/Auth**: [Supabase](https://supabase.com/) handles user authentication and cloud-syncing of snippets.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- npm

### Installation
```bash
npm install
```

### Local Development
To start the app with hot reloading for both the frontend and Electron:
```bash
npm run dev
```

## 🔐 Authentication & Cloud Sync

The application uses Supabase for real-time synchronization.

### Environment Variables
You must have a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Schema
The database requires a `snippets` table with Row Level Security (RLS) enabled.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Text | Unique identifier |
| `user_id` | UUID | Foreign key to `auth.users` |
| `title` | Text | Snippet title |
| `content` | Text | The code/text snippet |
| `created_at` | BigInt | Timestamp (ms) |

## 📦 Deployment & distribution

### 1. Web (Landing Page)
The landing page and web-preview are deployed to **Vercel**.
- **Requirement**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are added to the Vercel project settings under **Environment Variables**.

### 2. Desktop Apps (GitHub Actions)
Automated builds are configured via GitHub Actions in `.github/workflows/build.yml`.

- **Trigger**: Push a tag starting with `v` (e.g., `v1.0.3`).
- **Required Secrets**: You must add the following to your GitHub Repository Secrets:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Output**: The action generates a draft release on GitHub with:
  - **macOS**: `.dmg` (Universal)
  - **Windows**: `.exe` (NSIS)

## ⌨️ Shortcuts & Interaction

- **Global Activation**: `Cmd+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows).
- **Navigation**: Arrow keys to select, `Enter` to auto-paste into the previously active app.
- **Creation**: `Cmd+N` (macOS) or `Ctrl+N` (Windows) inside the app.

## 🛠 Maintenance

### Updating download links
When you release a new version, update the hardcoded `macLink` and `winLink` in **`index.html`** to point to the new GitHub Release assets.

### Building manually
If you need to build the app locally:
```bash
npm run dist
```
Find the output in the `release/` folder.

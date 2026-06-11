# 💻 Know-Way — Frontend

Next.js React client application for **Know-Way**. It visualizes adaptive knowledge roadmaps using interactive React Flow graphs, handles study timers, and supports live chat sessions with AI Tutors.

---

## 🛠️ Setup & Installation

### 1. Prerequisite Installations
Ensure you have **Node.js 18+** and **npm** installed.

### 2. Environment Configurations
Navigate to the directory, install dependencies, and create the environment file:

```bash
cd frontend
npm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
```

### 3. API URL Config
Edit `.env.local` to point to your FastAPI server endpoint (defaults to `http://127.0.0.1:8000`).

---

## 🚀 Running the Client

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📜 Development Scripts

Run the following commands using `npm run <script>`:

| Script | Description / Action |
| :--- | :--- |
| `dev` | Starts the Next.js development server (using Webpack). |
| `dev:turbo` | Starts the development server using Turbopack for faster hot reloads. |
| `build` | Compiles the Next.js client for production deployment. |
| `start` | Launches the compiled production application. |
| `clean` | Deletes local `.next` caching folders. |
| `lint` | Runs ESLint configuration checks. |

---

## 📁 Repository Layout

```
frontend/
├── app/                  # Next.js App Router folders (pages, layouts)
│   ├── assessment/       # MCQ Quiz & Free-Form submission view
│   ├── dashboard/        # Dashboard overview, streaks, and planner UI
│   ├── onboarding/       # Conversational onboarding chat flow
│   ├── planner/          # Integrated drag-and-drop learning calendar
│   └── roadmap/          # React Flow interactive graph canvas
├── components/           # UI elements (UI modules and sidebar layout)
├── lib/                  # State management, API wrappers, and types
│   ├── api.ts            # Axios REST API backend client
│   ├── app-context.tsx   # Global React context and status providers
│   ├── brand.ts          # Brand constants (Know-Way title & slogan)
│   └── types.ts          # Shared TypeScript type interfaces
└── package.json          # Node package dependencies list
```

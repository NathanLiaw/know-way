# ⚙️ Know-Way — API

FastAPI backend server for the **Know-Way** personalized learning platform. It manages agent actions, executes node workflows, and persists roadmaps, assessments, and dashboard metrics in MongoDB Atlas.

---

## 🛠️ Setup & Local installation

### 1. Prerequisite Installations
Ensure you have **Python 3.11+** installed on your system.

### 2. Environment Configurations
Clone the repository and initialize the workspace:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env         # Windows: copy .env.example .env
```

Edit the generated `.env` file to customize your configuration (MongoDB connection strings, AI models, and secrets).

### 3. Production Guidelines
When deploying to staging or production, ensure:
*   `EXPOSE_OPENAPI=false` (hides Swagger UI)
*   `RATE_LIMIT_ENABLED=true` (prevents API abuse)

---

## 🚀 Running the Server

Start the API server locally on port `8000`:

```bash
uvicorn app.main:app --reload --port 8000
```

*   **Swagger API Docs**: http://127.0.0.1:8000/docs  
*   **Health Status Endpoint**: http://127.0.0.1:8000/api/health  

---

## 🗄️ Database Collections

The backend structures learning progress using MongoDB collections. Indexes are automatically verified and built on application startup (`app/database.py`).

| Collection | Description / Purpose |
| :--- | :--- |
| `users` | User profile, demographics, and daily streak tracking. |
| `roadmaps` | Nodes, prerequisite edges, and learning progress metadata. |
| `assessments` | Generated quizzes, free-form tasks, and grading outputs. |
| `activity_entries` | Chronological action logs displayed on the user's dashboard. |

---

## 📁 Repository Layout

```
backend/
├── app/
│   ├── agents/      # Agent configurations, prompts, and ADK runners
│   ├── auth/        # Clerk verification middleware and decoders
│   ├── models/      # Pydantic schemas and database models
│   ├── routers/     # HTTP endpoint controllers (FastAPI)
│   ├── services/    # Business and grading logic implementation
│   ├── config.py    # Global settings parsed from environment variables
│   ├── database.py  # Motor client connection manager and index configurations
│   └── main.py      # Main FastAPI app entry point and CORS configurations
└── requirements.txt  # Python package dependencies list
```

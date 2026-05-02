# ☁️ CloudIQ
**Enterprise-Grade Agentic AI SaaS for Cloud Infrastructure Monitoring**

CloudIQ is a next-generation cloud infrastructure monitoring platform. Unlike traditional dashboards, CloudIQ uses a **Fully Autonomous AI Agent Architecture** powered by multi-model routing (Gemini + Local Llama 3) and a persistent Vector RAG (Retrieval-Augmented Generation) memory to analyze, predict, and execute infrastructure mutations in real-time.

---

## 🚀 Key Features
- **Intelligent Multi-Model Routing:** Uses LangChain to route simple queries to fast models and complex mutations to local Llama 3.
- **Persistent RAG Memory:** ChromaDB vector storage remembers past interactions, infrastructure anomalies, and user preferences.
- **Agentic UI Control:** The AI can directly execute commands on the frontend (e.g., navigating to graphs, changing themes, terminating idle servers) via Server-Sent Events (SSE).
- **Interactive 3D Visualizations:** Built-in WebGL Graph engine and 3D Globe to track cross-region blast radius and risk clusters.
- **What-If Cost Simulator:** Interactive sliders and sparkline dashboards for financial modeling.
- **Secure Authentication:** JWT-based user authentication powered by Supabase.

---

## 🛠️ Tech Stack
### **Frontend (UI/UX)**
- **Framework:** React 19 + Vite
- **Styling & Animations:** TailwindCSS 4, Framer Motion, Particle.js
- **Data Visualization:** Recharts, D3.js, React-Globe.gl, React-Force-Graph-2D
- **State Management:** Zustand
- **Auth:** `@supabase/supabase-js`

### **Backend (AI & API)**
- **Framework:** FastAPI (Python) + Uvicorn
- **AI Orchestration:** LangChain, CrewAI
- **Vector Database (RAG):** ChromaDB + Sentence Transformers
- **LLMs:** Google GenAI (Gemini) + Ollama (Llama 3 Local)
- **Database:** SQLAlchemy (SQLite / PostgreSQL)

---

## 💻 System Requirements
To run the full Agentic AI pipeline locally without performance bottlenecks:
- **OS:** Windows 10/11, macOS, or Linux
- **RAM:** 16GB Minimum (32GB Recommended if running Llama 3 locally)
- **Storage:** ~10GB Free Space (for Ollama model weights and ChromaDB storage)
- **Prerequisites:**
  - [Node.js](https://nodejs.org/en) (v18+ recommended)
  - [Python](https://www.python.org/downloads/) (v3.10+ recommended)
  - [Ollama](https://ollama.com/download) (Required for local Llama 3)

---

## 🏁 Step-by-Step Installation Guide

Follow these exact terminal commands to get CloudIQ running on your machine.

### Step 1: Install Ollama (Local AI Brain)
1. Download and install **Ollama** from `https://ollama.com/`.
2. Open a terminal and download the Llama 3 model:
```bash
ollama run llama3
```
*(Keep the Ollama app running in the background. It will serve the API on `localhost:11434`)*

### Step 2: Setup the Backend (FastAPI & LangChain)
Open a new terminal and navigate to the project directory:

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Create a virtual environment
python -m venv venv

# 3. Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 4. Install all AI and API dependencies
pip install -r requirements.txt
```

### Step 3: Setup the Frontend (React & Supabase)
Open another terminal (leave the backend terminal as is for now):

```bash
# 1. Navigate to the frontend folder
cd frontend

# 2. Install Node.js dependencies
npm install

# 3. Setup Environment Variables
# Create a .env file inside the frontend folder and add your Supabase credentials:
VITE_SUPABASE_URL="your_supabase_project_url"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

---

## 🏃‍♂️ How to Run the Project
To run the full system, you need **three** things running simultaneously:

**1. The Local AI Engine (Ollama)**
Make sure the Ollama app is open and running on your computer.

**2. Start the Backend Server**
Open a terminal, activate your virtual environment, and run:
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```
*The backend will be live at: `http://127.0.0.1:8000`*

**3. Start the Frontend Server**
Open a new terminal and run:
```bash
cd frontend
npm run dev
```
*The frontend will be live at: `http://localhost:5173`*

---

## 🧪 Testing the Agentic AI
1. Go to `http://localhost:5173` in your browser.
2. Sign in using your Supabase credentials.
3. Navigate to the **Assistant** page.
4. Try typing: `"What if I stop idle resources?"` or `"Terminate my idle servers."`
5. Watch the LangChain router intercept the command, pull context from ChromaDB, and generate an interactive **Action Card** directly in the chat UI!

---
*Built as a showcase for high-performance, industry-ready AI Engineering.*

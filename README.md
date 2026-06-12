# Subspace: Autonomous Academic Agent & Cosmic Navigator

Subspace is a state-of-the-art academic supervisor matching tool that maps candidate portfolios to compatible supervisors worldwide. It uses autonomous search agents, Google Search grounding, OpenAlex publication indexing, and an interactive 3D WebGL solar system view.

**Production Deployment Link**: [kaulvishesh.github.io/IwannaP_hD/](https://kaulvishesh.github.io/IwannaP_hD/)

---

## 🌌 Core Features

### 1. Cosmic 3D Orbit Map (WebGL Space Viewport)
An immersive, hardware-accelerated 3D celestial canvas built with **Three.js** and **OrbitControls**:
* **Scroll-to-Zoom & Drag-to-Pan**: Seamlessly navigate through the constellation of academic matches.
* **Sun Core & Coordinates**: The candidate is rendered as the central rotating Sun, with matched academic entities orbiting in concentric tracks (Interests, Universities, and Professors).
* **Billboard Text Sprites**: Node names face the camera at all times using dynamic text canvas textures.
* **Animated Data Pulses**: Floating particle lines showing glowing energy streams flowing along active connections.
* **Raycasted Hover & Click**: Real-time cursor interaction that triggers mechanical audio synths and populates the details inspector.

### 2. High-Fidelity Directory Dashboard
A premium tabular workspace engineered from the ground up:
* **Academic Analytics HUD**: Displays live matching statistics (Matched count, Peak compatibility score, Average H-Index, Total citation footprint pool, Unique institutions represented).
* **Interactive Filter Control**: Filter results on the fly using fuzzy search inputs, a minimum match score threshold slider, and specific university dropdowns.
* **Sorting Engine**: Sort profiles instantly by Compatibility Score, H-Index rating, Citations impact, or Alphabetical order.
* **Grid vs. Accordion List Layouts**: Toggle views between standard visual cards or spreadsheet-like accordion rows that slide down to reveal papers, outreach email drafts, and beliefs sentiment profiles.

### 3. Intake Parser & Real-Time Agent Stream
* **Resume Parsing**: Upload academic resumes or SOPs (PDF/TXT/MD) to extract research interests.
* **WebSocket Log Streams**: Watch the agent query OpenAlex and scrape publication indexes live in a floating terminal console.

---

## 🛠️ Technology Stack

* **Frontend**: React (v19), Vite, CSS custom variables, Three.js, OrbitControls, and lightweight Web Audio API click/hover synthesizers.
* **Backend**: FastAPI (Python), WebSocket server, and agent memory JSON indexes.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Python 3.10+](https://www.python.org/)

### 1. Running Backend Server
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up environment variables in a `.env` file (e.g., Gemini API keys).
4. Run the Uvicorn server:
   ```bash
   python backend_server.py
   ```
   *The server runs locally on [http://localhost:8000](http://localhost:8000).*

### 2. Running Frontend Client
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *The client runs locally on [http://localhost:5173](http://localhost:5173).*

### 3. Production Build & Deployment
Build the client application and deploy to GitHub Pages:
```bash
cd frontend
npm run deploy
```
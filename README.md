# SliceMatic — Order Intake & AI Analytics Dashboard

SliceMatic is a custom full-stack web application built to replace the error-prone Google Form and Sheet workflow for the pizzeria (managed by Rajan Sharma). 

It delivers high-reliability user input validation, a precise automated invoicing engine, persistent record storage, repeat customer recognition, and an AI-powered natural language insights dashboard.

---

## 🎨 Architecture Overview
SliceMatic uses a high-performance **Full-Stack (React + Express)** architecture configured for rapid execution, durable local file database persistence, and native Google Gemini API acceleration.

### Core Components
1. **Frontend Core (React 19 + Tailwind CSS 4)**
   - **Customer Intake Panel**: Standardized customer fields validated live on keystroke and before submit.
   - **Interactive Configurator**: Renders categories loaded live from structured backend menu files (`menu_base.txt`, `menu_pizza.txt`, `menu_toppings.txt`).
   - **Real-Time Invoice Review**: An itemized column layout displaying prices, subtotals, automatic bulk discount, GST at 18%, and payable totals correct to the paisa.
   - **Admin Analytics Dashboard**: High-level statistical cards coupled with an interactive historical transaction feed.
2. **Backend Server (Express + TypeScript + Vite Middleware)**
   - Serves API routes on `/api/*` and proxies Vite's hot SPA files.
   - Restricts file reading and operations behind local, secure JSON database layers (`/data/slicematic_db.json`) and append-only text logging (`/orders_log.txt`).
3. **Database Layer (Local Structured & Plain-Text)**
   - **`orders_log.txt`**: Appends order records in a structured, line-by-line format parseable by regex or automation.
   - **`slicematic_db.json`**: An transactional schema mapping `orders` and `order_items` for dense analytics.
4. **AI Analytics Assistant (Gemini 2.5 Flash)**
   - Generates contextual, data-grounded business insights for the owner from live sales statistics.

---

## 🚀 Setup & Run Instructions

### Prerequisites
- **Node.js 18+**
- **npm** or **yarn**

### Local Development
1. Clone or download the project workspace.
2. Install base dependencies:
   ```bash
   npm install
   ```
3. Set your environment variable inside a `.env` file at the root:
   ```env
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```
4. Fire up the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Production Build & Deployment
Build both the React app and the bundled Node server:
```bash
npm run build
```
This produces optimized client assets in `dist/` and compiles the unified Express server to a standalone bundle at `dist/server.cjs`.

Start the server:
```bash
npm run start
```

---

## 🧠 AI Demand & Sales Insights

### Selected Model
We selected **`gemini-2.5-flash`** via Google's official `@google/genai` TypeScript SDK. 
- **Reasoning**: It delivers sub-second response times, has zero execution cost within standard AI Studio sandbox limits, understands tabular/JSON layouts flawlessly, and has an exceptionally high reasoning quality suited for business diagnostics.

### AI System Prompt
```markdown
You are "SliceMatic Insights AI", Rajan Sharma's intelligent business analytics assistant for the SliceMatic pizzeria. 
You will be given structured aggregations and historical logs of pizza orders. 
Answer Rajan's question clearly, concisely, and with high business usefulness. 

Follow these strict constraints:
1. Ground every single claim or number strictly on the provided data.
2. If the question asks about something not represented in the data, state clearly and politely that you do not have that data, rather than hallucinating or guessing.
3. Keep the tone professional, objective, supportive, and business-focused.
4. Keep the answer highly scannable, and avoid bloated paragraphs.
```

---

## 🛡️ Input Validation & Hardened Edge Cases
SliceMatic handles adversarial inputs elegantly inside individual validation checkpoints (never crashing or showing raw stack traces to users):
1. **Name Field Validation**: Limits characters between 2 and 40, rejecting any digits, symbols, spaces-only strings, or empty fields.
2. **Phone Number Verification**: Mandates exactly 10 digits starting with `6, 7, 8, or 9`, rejecting all letters, invalid starting prefixes, or short numbers.
3. **Quantity Restriction**: Restricts input to whole integers between `1 and 10`, rejecting floats, letters, zero, negative integers, or numbers greater than 10.
4. **Payment Mode Handling**: Strictly locks selections to `Cash, Card, or UPI` using tactile selection tiles.
5. **Menu File Robustness**: Malformed lines (e.g., missing price values) inside `menu_base.txt`, `menu_pizza.txt`, or `menu_toppings.txt` are skipped with warnings in the server logs, allowing the system to boot successfully. Complete missing files cause clear, clean exits at startup.

---

## ⚠️ Known Limitations
- **Local Persistence Boundary**: The database operates on local server storage. If redeployed to ephemeral containers (like raw non-mounted Cloud Run without persistent disk), the local JSON file database and `orders_log.txt` will reset on container restarts. (We mitigate this by structuring all endpoints to perfectly transition to external Cloud SQL or Firestore backends).
- **Single Active Itemization**: The current Intake form supports configuration of one pizza combo at a time (crust + style + selected toppings) with an assigned quantity, which represents 100% of the SliceMatic Google Form replacement scope.

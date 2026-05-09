# TaxOptimizer India — Full Stack

AI-powered Indian capital gains tax optimizer with ML-driven tax-loss harvesting.

## Stack
| Layer      | Tech                                      |
|------------|-------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite + Recharts   |
| Backend    | FastAPI + SQLAlchemy + PostgreSQL          |
| ML         | XGBoost harvest priority model            |
| AI Advisor | Claude (Anthropic API)                    |
| Auth       | JWT (python-jose + bcrypt)                |
| Cache      | Redis                                     |
| Deploy     | Docker Compose                            |

## Project structure
```
taxoptimizer/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS
│   │   ├── api/
│   │   │   ├── auth.py          # Register / login (JWT)
│   │   │   ├── portfolio.py     # Holdings CRUD
│   │   │   ├── tax.py           # Tax summary + harvest + scenario
│   │   │   ├── advisor.py       # Claude AI chat
│   │   │   └── upload.py        # Broker CSV parser
│   │   ├── core/
│   │   │   ├── config.py        # Settings + DB session
│   │   │   ├── security.py      # JWT utils
│   │   │   └── tax_engine.py    # Deterministic Indian tax rules
│   │   ├── ml/
│   │   │   └── harvesting_model.py  # XGBoost harvest recommender
│   │   └── models/
│   │       └── models.py        # SQLAlchemy ORM models
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Router + auth guard
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Metrics + charts + action items
│   │   │   ├── Portfolio.tsx    # Holdings table + CSV upload
│   │   │   ├── TaxReport.tsx    # Detailed STCG/LTCG computation
│   │   │   ├── Harvest.tsx      # ML harvest recommendations
│   │   │   ├── Scenario.tsx     # Sell scenario simulator
│   │   │   ├── Advisor.tsx      # Claude AI chat
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   ├── components/
│   │   │   └── Layout.tsx       # Sidebar nav
│   │   ├── services/
│   │   │   └── api.ts           # All API calls (axios)
│   │   └── store/
│   │       └── index.ts         # Zustand global state
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## Quick start (Docker — recommended)

```bash
# 1. Clone and enter
git clone <your-repo>
cd taxoptimizer

# 2. Set env vars
cp backend/.env.example backend/.env
# Edit backend/.env:
#   ANTHROPIC_API_KEY=sk-ant-...
#   SECRET_KEY=your-random-secret

# 3. Run everything
docker compose up --build

# App: http://localhost:3000
# API docs: http://localhost:8000/docs
```

## Manual setup (dev)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys

# Start PostgreSQL + Redis (or use Docker for just those):
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=taxoptimizer postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine

# Init DB
python -c "from app.core.config import init_db; init_db()"

# Train ML model
python -c "from app.ml.harvesting_model import _train_and_save_model; _train_and_save_model()"

# Run
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

## Indian tax rules implemented
- **STCG** (equity held < 12 months): 20% flat
- **LTCG** (equity held ≥ 12 months): 12.5% above ₹1,25,000 annual exemption (Budget 2024)
- **Loss offsetting**: STCG losses offset both STCG + LTCG; LTCG losses only offset LTCG
- **Carry forward**: Losses can be carried forward 8 years (track via transactions)
- **No wash-sale rule** in India — sell and repurchase immediately
- **₹1.25L reset trick**: Book LTCG profits under exemption limit each FY and reinvest to reset cost basis

## ML model — XGBoost harvest recommender
Features used:
1. `pnl_pct` — unrealized loss %
2. `holding_months` — months held
3. `days_to_ltcg` — days until LTCG threshold
4. `days_to_fy_end` — days until 31 Mar (FY deadline)
5. `loss_amount` — absolute ₹ loss
6. `tax_saving` — ₹ tax saved if harvested
7. `volatility_proxy` — estimated price volatility
8. `is_ltcg` — binary LTCG flag

Output: priority score 0–1 → "urgent" | "consider" | "hold"

The deterministic tax engine always computes actual ₹ amounts. The ML model only ranks urgency.

## API endpoints
```
POST /api/auth/register
POST /api/auth/login

GET  /api/portfolio/
POST /api/portfolio/
POST /api/portfolio/{id}/holdings
PUT  /api/portfolio/{id}/holdings/{hid}
DEL  /api/portfolio/{id}/holdings/{hid}
POST /api/upload/{id}/csv

GET  /api/tax/{id}/summary
GET  /api/tax/{id}/harvest      ← ML recommendations
POST /api/tax/{id}/scenario

POST /api/advisor/chat          ← Claude AI
```

## Roadmap
- [ ] Zerodha Kite API real-time price sync
- [ ] Groww API integration
- [ ] NSE/BSE live prices via WebSocket
- [ ] Tax-loss harvesting alerts (email/push)
- [ ] ITR-2 Schedule CG auto-fill export
- [ ] Multi-year loss carry-forward tracking
- [ ] B2B: CA firm dashboard (manage multiple clients)

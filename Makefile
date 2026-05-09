.PHONY: help install dev test migrate lint docker clean

help:
	@echo "TaxOptimizer India — Dev Commands"
	@echo ""
	@echo "  make install    Install all dependencies"
	@echo "  make dev        Start backend + frontend in dev mode"
	@echo "  make test       Run backend test suite"
	@echo "  make migrate    Run database migrations"
	@echo "  make train-ml   Train / retrain XGBoost harvest model"
	@echo "  make lint       Run ruff linter on backend"
	@echo "  make docker     Start full stack via Docker Compose"
	@echo "  make clean      Remove build artifacts"

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev:
	@echo "Starting backend..."
	cd backend && uvicorn app.main:app --reload --port 8000 &
	@echo "Starting frontend..."
	cd frontend && npm run dev

test:
	cd backend && pytest tests/ -v --tb=short

migrate:
	cd backend && alembic upgrade head

train-ml:
	cd backend && python -c "from app.ml.harvesting_model import _train_and_save_model; _train_and_save_model(); print('ML model trained and saved')"

lint:
	cd backend && python -m ruff check app/ --fix

docker:
	docker compose up --build

docker-down:
	docker compose down -v

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf frontend/dist frontend/node_modules/.cache

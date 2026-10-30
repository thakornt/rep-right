API := apps/api
TEST_DATABASE_URL ?= postgres://repright:repright@localhost:55432/repright_test?sslmode=disable

.PHONY: up down logs test test-db lint sqlc sqlc-check migrate web

up: ## Start postgres + api (runs migrations first)
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f api

test: ## Unit tests (no database needed)
	cd $(API) && go test ./...

test-db: ## All tests including Postgres integration tests (needs `make up`)
	cd $(API) && TEST_DATABASE_URL="$(TEST_DATABASE_URL)" go test -count=1 ./...

lint:
	cd $(API) && go vet ./... && docker run --rm -v "$$PWD":/app -w /app golangci/golangci-lint:latest golangci-lint run

sqlc: ## Regenerate type-safe queries from db/queries
	cd $(API) && go tool sqlc generate

sqlc-check: ## Fail if generated code is out of date
	cd $(API) && go tool sqlc diff

migrate: ## Apply migrations to the compose database
	docker compose run --rm migrate

web: ## Next.js dev server on :3000, proxying /api/* to the local API
	cd apps/web && npm install && npm run dev

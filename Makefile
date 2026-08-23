.DEFAULT_GOAL := help
APP_DIR := app

.PHONY: help install dev build preview clean reinstall status

help:
	@echo "QA Testing Report — Vue app commands (all operate on ./$(APP_DIR)):"
	@echo ""
	@echo "  make install    Install app dependencies (npm install)"
	@echo "  make dev        Start the Vite dev server"
	@echo "  make build      Production build (npm run build)"
	@echo "  make preview    Preview the last production build locally"
	@echo "  make clean      Remove app/node_modules and app/dist"
	@echo "  make reinstall  clean + install, for a fresh dependency tree"
	@echo "  make status     Show git branch/status and app/ dependency state"

install:
	cd $(APP_DIR) && npm install

dev:
	cd $(APP_DIR) && npm run dev

build:
	cd $(APP_DIR) && npm run build

preview:
	cd $(APP_DIR) && npm run preview

clean:
	rm -rf $(APP_DIR)/node_modules $(APP_DIR)/dist

reinstall: clean install

status:
	@echo "--- git ---"
	@git branch --show-current
	@git status --short
	@echo "--- app/ deps ---"
	@test -d $(APP_DIR)/node_modules && echo "node_modules: installed" || echo "node_modules: MISSING (run: make install)"

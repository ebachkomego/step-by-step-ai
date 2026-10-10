#!/usr/bin/env bash
echo "Starting StepByStep AI Backend..."
cd "$(dirname "$0")"
if [ -d "./venv" ]; then
    source ./venv/bin/activate
fi
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

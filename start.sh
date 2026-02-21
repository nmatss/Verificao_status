#!/bin/bash
# Start both the Python API backend and Next.js dashboard

echo "=== Starting Certificacao Dashboard ==="
echo ""

# Start Python FastAPI backend
echo "[1/2] Starting Python API on port 8000..."
cd "$(dirname "$0")"
python3 -m uvicorn verificacao_certificacao.api_server:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!
echo "  API PID: $API_PID"

# Wait for API to be ready
sleep 2

# Start Next.js dashboard
echo "[2/2] Starting Next.js dashboard on port 3000..."
cd dashboard
npm run dev &
NEXT_PID=$!
echo "  Next.js PID: $NEXT_PID"

echo ""
echo "=== Services Running ==="
echo "  API:       http://localhost:8000"
echo "  Dashboard: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and cleanup on exit
trap "kill $API_PID $NEXT_PID 2>/dev/null; exit" INT TERM
wait

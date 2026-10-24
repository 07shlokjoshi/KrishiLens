# Multi-stage build for KrishiLens
# Stage 1: Python YOLO Server
FROM python:3.11-slim as python-base

WORKDIR /app

# Install system dependencies for YOLO
RUN apt-get update && apt-get install -y \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements.txt* .

# Install Python dependencies
RUN pip install --no-cache-dir \
    ultralytics \
    torch \
    torchvision \
    opencv-python \
    pillow \
    numpy \
    fastapi \
    uvicorn \
    python-dotenv \
    2>/dev/null || pip install --no-cache-dir ultralytics fastapi uvicorn

# Stage 2: Node.js Frontend + Backend
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy frontend assets
COPY public ./public

# Copy backend code
COPY server.js .
COPY src ./src
COPY scripts ./scripts
COPY data ./data

# Copy training/evaluation code
COPY experiments ./experiments

# Copy Python YOLO server (from previous stage)
COPY --from=python-base /app /app

# Expose ports
EXPOSE 3001 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start both servers
CMD ["sh", "-c", "npm start & (.venv/bin/python src/services/yoloServer.py || python src/services/yoloServer.py) & wait"]

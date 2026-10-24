# KrishiLens Deployment Guide

## ⚠️ Important: Architecture Limitations

**Current Issue:** KrishiLens has a **hybrid architecture** that creates deployment challenges:
- ✅ Frontend: React (Node.js) - **Can deploy to Vercel**
- ✅ Backend: Express.js (Node.js) - **Can deploy to Vercel**
- ❌ ML Pipeline: Python/YOLO - **Cannot run on Vercel** (Node.js only platform)

---

## Deployment Options

### Option 1: Local Development Only (Current Setup)
**Best for:** Development, testing, model training

```bash
# Terminal 1: YOLO Server
.venv/bin/python src/services/yoloServer.py

# Terminal 2: Express Backend
npm start

# Browser: http://localhost:3001
```

**Pros:**
- Full functionality
- Easy to test
- Can train models locally
- No limitations

**Cons:**
- Only works on your machine
- Not accessible from internet

---

### Option 2: Deploy to Vercel (Frontend + Backend) WITHOUT YOLO
**Best for:** Production deployment without ML inference

Remove Python dependency from production:

```bash
# Install & deploy only Node.js parts
npm install
npm run build
# Deploy to Vercel
vercel
```

**Changes needed:**
1. Disable YOLO inference endpoint
2. Use mock predictions or API fallback
3. Focus on UI/UX features

**Pros:**
- Easy Vercel deployment
- Globally distributed
- Fast CDN
- Free tier available

**Cons:**
- No real YOLO inference
- Need alternative ML service

---

### Option 3: Deploy with External YOLO Service
**Best for:** Production with real ML predictions

Architecture:
```
Vercel (Frontend + Node Backend)
    ↓
External YOLO Service (Python)
    ├── AWS Lambda + Docker
    ├── Google Cloud Run
    ├── Railway.app (Python support)
    ├── Render (Python support)
    └── Your own server
```

**Setup:**

1. **Deploy YOLO Server separately** (e.g., Railway.app)
   ```bash
   # Create Railway.app account
   # Connect your repo
   # Set Python buildpack
   # Deploy Python server
   ```

2. **Update Express config** to use external YOLO URL
   ```javascript
   // server.js
   const YOLO_SERVER_URL = process.env.YOLO_SERVER_URL || 'http://localhost:5001';
   ```

3. **Deploy frontend to Vercel**
   ```bash
   npm run build
   vercel --env YOLO_SERVER_URL=https://your-yolo-server.railway.app
   ```

**Pros:**
- Full functionality
- Scalable
- Professional setup
- Supports training

**Cons:**
- More complex
- Multiple deployments
- Cost ($5-10/month for YOLO server)

---

### Option 4: Use Existing ML API Service
**Best for:** No-code deployment

Use existing pesticide detection APIs:
- Roboflow hosted inference
- Hugging Face Spaces
- Clarifai
- Custom trained model endpoints

**Setup:**
```javascript
// Replace local YOLO with API call
const response = await fetch('https://api.roboflow.com/detect', {
  image: imageData,
  apiKey: process.env.ROBOFLOW_API_KEY
});
```

**Pros:**
- Simple integration
- No server management
- Scalable
- Professional

**Cons:**
- Monthly API costs
- Rate limits
- Less control

---

## Recommended Setup for Production

### **For Most Users: Option 3 (Railway.app + Vercel)**

**Step 1: Deploy YOLO Server to Railway.app**

```bash
# 1. Sign up at railway.app
# 2. Create new project
# 3. Connect GitHub repo
# 4. Add Python buildpack
# 5. Set start command: 
#    .venv/bin/python src/services/yoloServer.py

# Environment variables:
PORT=5001
```

**Step 2: Deploy App to Vercel**

```bash
# 1. Push to GitHub
git push origin main

# 2. Deploy to Vercel
vercel --prod

# 3. Add environment variable:
YOLO_SERVER_URL=https://your-krishilens-yolo.railway.app
```

**Step 3: Update Express Server**

```javascript
// server.js - Add YOLO_SERVER_URL support
const YOLO_SERVER_URL = process.env.YOLO_SERVER_URL || 'http://localhost:5001';
```

---

## Current Status

```
✅ Local Development: FULLY WORKING
   npm start → http://localhost:3001

⚠️  Vercel Deployment: PARTIAL
   Frontend & Backend: ✅ YES
   Python YOLO: ❌ NO (requires external service)

🔴 Single-Platform Deployment: NOT POSSIBLE
   Would need Node.js version of YOLO (alternative: ONNX.js)
```

---

## Quick Decision Matrix

| Scenario | Recommendation | Effort | Cost |
|----------|---|---|---|
| Development | Local only | 5 min | $0 |
| Demo/Testing | Local + ngrok tunnel | 10 min | $0 |
| Personal project | Railway + Vercel | 1 hour | $5-10/mo |
| Production | Railway + Vercel + monitoring | 2 hours | $20+/mo |
| Enterprise | Kubernetes + Docker | 1 week | $100+/mo |

---

## Commands for Different Deployments

### Local Development
```bash
# Terminal 1: Python YOLO Server
.venv/bin/python src/services/yoloServer.py

# Terminal 2: Node Express Backend
npm start

# Open: http://localhost:3001
```

### Vercel Only (No YOLO)
```bash
vercel --prod
```

### Railway + Vercel (With YOLO)
```bash
# Deploy YOLO to Railway
git push github main  # Railway auto-deploys via GitHub integration

# Deploy frontend to Vercel
vercel --prod --env YOLO_SERVER_URL=https://your-railway-url
```

---

## Environment Variables Needed

```
# For Vercel deployment
YOLO_SERVER_URL=https://your-yolo-server.railway.app
NODE_ENV=production

# For Railway deployment (YOLO)
PORT=5001
PYTHONUNBUFFERED=1
```

---

## Files to Update for Deployment

### server.js
```javascript
// Read YOLO server from environment
const YOLO_SERVER_URL = process.env.YOLO_SERVER_URL || 'http://localhost:5001';

// Use in routes
app.post('/api/yolo/detect', async (req, res) => {
  try {
    const response = await fetch(`${YOLO_SERVER_URL}/detect`, {
      method: 'POST',
      body: req.body
    });
    // ... rest of code
  }
});
```

### vercel.json
```json
{
  "buildCommand": "npm run build",
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

## Troubleshooting Deployment

### "Build failed" on Vercel
- ✅ Check: `npm run build` passes locally
- ✅ Check: All dependencies in package.json
- ✅ Check: No Python imports in Node code

### YOLO inference 404 errors
- ✅ Check: YOLO_SERVER_URL environment variable set
- ✅ Check: YOLO server is running/deployed
- ✅ Check: Network connectivity between services

### Railway Python server won't start
- ✅ Check: Python 3.9+ available
- ✅ Check: requirements.txt exists
- ✅ Check: PORT environment variable set

---

## Conclusion

**KrishiLens is production-ready but requires:**

1. **Frontend:** Vercel ✅ (Easy)
2. **Backend:** Vercel ✅ (Easy)
3. **ML Pipeline:** External service ⚠️ (Moderate)

**Recommended path:** Railway.app for YOLO + Vercel for frontend = **30-60 minutes setup time**, **$5-10/month cost**


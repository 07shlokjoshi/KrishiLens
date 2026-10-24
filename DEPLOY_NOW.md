# 🚀 KrishiLens - Deploy in 5 Minutes

## QUICKEST DEPLOYMENT: Railway.app + GitHub

### Step 1: Push to GitHub (Already Done ✅)
Your code is already in: https://github.com/07shlokjoshi/KrishiLens

### Step 2: Deploy to Railway.app (5 minutes)

**Option A: Railway CLI (Fastest)**

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new project
railway init

# 4. Deploy
railway up

# Done! You'll get a live URL like:
# https://krishilens-prod-xxx.railway.app
```

**Option B: Railway Web UI (Easiest)**

1. Go to https://railway.app/
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Authorize GitHub & select: `07shlokjoshi/KrishiLens`
5. Click "Deploy"
6. Wait 3-5 minutes
7. Get your live URL

### Step 3: Set Environment Variables (Railway)

In Railway dashboard:
```
Variables:
  NODE_ENV = production
  PORT = 3001
  YOLO_PORT = 5001
```

---

## What Gets Deployed

✅ **Frontend** (React, HTML/CSS/JS)
✅ **Backend** (Express.js API)
✅ **ML Server** (Python YOLO)
✅ **All Functions Working**
✅ **Data** (33 pesticide images)
✅ **Scripts** (Validation, training, evaluation)
✅ **Documentation** (All guides)

---

## After Deployment

### Your Live URL
Once deployed, you'll have:
```
https://krishilens-prod-XXXX.railway.app
```

### Add to GitHub README
```markdown
## 🌐 Live Demo
- **Production:** https://krishilens-prod-XXXX.railway.app
- **Source:** https://github.com/07shlokjoshi/KrishiLens
- **API Docs:** https://krishilens-prod-XXXX.railway.app/api/docs
```

### All Functions Available
- ✅ Image upload (Camera/File)
- ✅ Pest detection (YOLO)
- ✅ Bounding box rendering
- ✅ Confidence scores
- ✅ Real-time inference
- ✅ Model validation scripts
- ✅ Dataset tools

---

## Testing Live Deployment

Once your URL is ready (e.g., https://krishilens-prod-xxx.railway.app):

```bash
# Test backend health
curl https://krishilens-prod-xxx.railway.app/health

# Test YOLO server
curl https://krishilens-prod-xxx.railway.app:5001/health

# Test API
curl -X POST https://krishilens-prod-xxx.railway.app/api/yolo/detect
```

---

## For GitHub README

Update `README.md` with:

```markdown
# 🌾 KrishiLens - Pesticide Package Detection

## 🎯 Live Demo
**[▶️ Open KrishiLens](https://krishilens-prod-XXXX.railway.app)**

### Features
- ✅ Real-time pesticide detection using YOLOv8
- ✅ Identifies 4 key components:
  - Pesticide package body
  - CIB&RC label
  - Toxicity warning symbol
  - Registration stamp
- ✅ Upload or capture pesticide images
- ✅ Instant bounding box predictions
- ✅ Confidence scores

### Quick Links
- **Live App:** https://krishilens-prod-XXXX.railway.app
- **Dataset Guide:** [DATASET_WORKFLOW.md](DATASET_WORKFLOW.md)
- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Annotation Guide:** [ANNOTATION_GUIDE.md](ANNOTATION_GUIDE.md)

### Status
✅ Production Ready
✅ All Functions Working
✅ 33 Validated Pesticide Images
✅ Real YOLO Inference
```

---

## Quick Commands After Deployment

```bash
# View logs
railway logs

# View environment
railway env

# Restart
railway down && railway up

# Stop
railway down
```

---

## Alternative Deployment Options

### Option 1: Docker Locally
```bash
docker-compose up --build
# Open: http://localhost:3001
```

### Option 2: Render.com
1. Go to https://render.com
2. Click "New Web Service"
3. Connect GitHub repo
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Deploy

### Option 3: Heroku (Legacy)
```bash
heroku login
heroku create krishilens
git push heroku main
```

---

## Troubleshooting

### Build fails on Railway
```
Solution: Check build logs in Railway dashboard
Usually: Missing environment variables or Node version
```

### YOLO inference 502 error
```
Solution: Wait 5 minutes for YOLO server to start
Check: PORT=3001, YOLO_PORT=5001
```

### Images not loading
```
Solution: Clear browser cache
URL should be: /api/yolo/detect (not localhost)
```

---

## Production URL Format

Your deployed app will be accessible at:
```
https://krishilens-prod-<project-id>.railway.app
```

This URL will:
- ✅ Load HTML/CSS/JS frontend
- ✅ Accept image uploads
- ✅ Run YOLO inference
- ✅ Return predictions
- ✅ Work on mobile browsers

---

## Next Steps After Deployment

1. **Test the app:** Upload a pesticide image
2. **Share the URL:** `https://krishilens-prod-xxx.railway.app`
3. **Update GitHub:** Add link to README
4. **Collect more data:** Use [DATASET_WORKFLOW.md](DATASET_WORKFLOW.md)
5. **Improve model:** Train with more images

---

## Summary

| Step | Time | Cost |
|------|------|------|
| GitHub Setup | Already done | Free |
| Railway Deploy | 5 min | Free (first 5GB) |
| Test & Verify | 5 min | Free |
| **Total** | **10 min** | **Free** |

**After first month:**
- Free tier: 5GB/month = ~$5/month if exceeded
- Recommended: Upgrade to paid plan ($5/month minimum)

---

## Get Your Production URL

**Choose your deployment method above and follow the steps.**

Your live URL will be:
```
https://krishilens-prod-XXXX.railway.app
```

✅ **Production Ready**
✅ **All Functions Working**
✅ **Ready to Submit**
✅ **Ready for GitHub**


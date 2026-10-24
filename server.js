import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import scanRouter from "./src/routes/scan.js";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Static frontend: serve Vite build (dist) if present, otherwise fallback to public
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(path.join(__dirname, "public")));
// Serve test benchmark images
app.use("/test-images", express.static(path.join(__dirname, "data", "test_images")));

// API Routes
app.use("/api", scanRouter);

// Health check
app.get("/api/health", (req, res) => {
  const hasHfToken = Boolean(process.env.HF_TOKEN && process.env.HF_TOKEN.length > 5);
  res.json({
    status: "healthy",
    service: "KrishiLens API",
    version: "1.0.0",
    environment: {
      has_hf_token: hasHfToken,
      vision_model: process.env.VISION_MODEL || "google/gemma-4-31B-it:novita",
      port: PORT
    },
    timestamp: new Date().toISOString()
  });
});

// Test benchmark samples endpoint
app.get("/api/test-samples", (req, res) => {
  const gtPath = path.join(__dirname, "data", "ground_truth.json");
  if (!fs.existsSync(gtPath)) {
    return res.status(404).json({ error: "Ground truth not generated yet" });
  }
  const data = JSON.parse(fs.readFileSync(gtPath, "utf-8"));
  const samples = data.test_cases.map(tc => ({
    ...tc,
    imageUrl: `/test-images/${tc.filename}`
  }));
  res.json({ test_cases: samples });
});

// SPA fallback
app.use((req, res) => {
  const distIndex = path.join(__dirname, "dist", "index.html");
  const pubIndex = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  if (fs.existsSync(pubIndex)) {
    return res.sendFile(pubIndex);
  }
  res.send("KrishiLens Backend Running. Build frontend to view UI.");
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌾 KrishiLens Pesticide Label Reader Server Running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🤖 Model: ${process.env.VISION_MODEL || "google/gemma-4-31B-it:novita"}`);
  console.log(`=======================================================`);
});

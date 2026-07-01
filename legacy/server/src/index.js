import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import expenseRoutes from "./routes/expenses.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Serve uploaded receipt images.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api", expenseRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🌸 Bill splitter API running on http://localhost:${PORT}`);
});

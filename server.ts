import express from "express";
import path from "path";
import dotenv from "dotenv";
import { registerApiRoutes } from "./src/server/registerApiRoutes";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerApiRoutes(app);

async function startServer() {
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: `API endpoint bulunamadı: ${req.method} ${req.originalUrl}. Sunucuyu "npm run dev" ile başlatın.`,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      return vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // Intercept html, service worker, and manifest requests to disable browser caching
    app.use((req, res, next) => {
      const normPath = req.path.toLowerCase();
      const isHtmlOrSwOrManifest =
        normPath === "/" ||
        normPath.endsWith(".html") ||
        normPath === "/index.html" ||
        normPath === "/sw.js" ||
        normPath === "/manifest.json";
      if (isHtmlOrSwOrManifest) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });

    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        index: false,
      })
    );

    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

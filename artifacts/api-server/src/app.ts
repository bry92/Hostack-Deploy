import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import router from "./routes/index.js";
import { getAllowedCorsOrigins } from "./lib/auth.js";

const app: Express = express();
const allowedOrigins = new Set(getAllowedCorsOrigins());

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Allow non-browser clients and explicit trusted browser origins only.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;

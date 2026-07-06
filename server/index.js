import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze.js";
import { config } from "./config.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", analyzeRouter);

app.listen(config.port, () => {
  console.log(`Backend berjalan pada http://localhost:${config.port}`);
});

import dotenv from "dotenv";
dotenv.config();

// Mode options:
// - 'local': Full heuristic mode (no API call, ~70% accuracy, instant)
// - 'hybrid': Heuristics + LLM for borderline cases (default, ~85% accuracy)
// - 'llm': Full LLM analysis (slower, higher cost, ~95% accuracy)
const validModes = ["local", "hybrid", "llm"];
const configuredMode = process.env.MODE?.toLowerCase() || "hybrid";

export const config = {
  port: process.env.PORT || 4000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  mode: validModes.includes(configuredMode) ? configuredMode : "hybrid",
};

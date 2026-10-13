import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApiClient } from "./api.js";
import { App } from "./App.js";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <StrictMode>
    <App api={createApiClient()} />
  </StrictMode>,
);

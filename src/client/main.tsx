import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { WorklogDataProvider } from "./WorklogDataProvider";
import "./styles.css";

const data = import.meta.env.MODE === "demo"
  ? (await import("./demo-data-access")).createBrowserDemoDataAccess()
  : (await import("./http-data-access")).createHttpDataAccess();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorklogDataProvider value={data}>
      <App />
    </WorklogDataProvider>
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@doenet/doenetml-iframe/style.css";
import "./index.css";
import App from "./App";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

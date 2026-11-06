import "./platform/offline";
import "./app/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { isMobileDevice, MobileNotice } from "./platform/MobileNotice";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isMobileDevice() ? <MobileNotice /> : <App />}
  </React.StrictMode>,
);

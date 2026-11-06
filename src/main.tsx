import "./offline";
import "./styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isMobileDevice, MobileNotice } from "./MobileNotice";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isMobileDevice() ? <MobileNotice /> : <App />}
  </React.StrictMode>,
);

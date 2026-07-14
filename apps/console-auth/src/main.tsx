import { createRoot } from "react-dom/client";
import { AuthApp } from "./AuthApp";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("FanPass Console Auth root element is missing");
}

createRoot(root).render(<AuthApp />);

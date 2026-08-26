import { createRoot, type Root } from "react-dom/client";
import Widget from "./Widget";
import "./index.css";

export function mount(el: HTMLElement): Root {
  const root = createRoot(el);
  root.render(<Widget />);
  return root;
}

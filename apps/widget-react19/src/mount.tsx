import { createRoot, type Root } from "react-dom/client";
import Widget from "./Widget";

export function mount(el: HTMLElement): Root {
  const root = createRoot(el);
  root.render(<Widget />);
  return root;
}

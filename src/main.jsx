import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SpeechTranscription from "./SpeechTranscription.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SpeechTranscription />
  </StrictMode>
);

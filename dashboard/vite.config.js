import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Passe den base-Pfad an deinen GitHub-Repo-Namen an:
//   https://DEIN_USERNAME.github.io/REPO_NAME/
// Beispiel: base: "/box-monitor/"
export default defineConfig({
  plugins: [react()],
  base: "/monitorbox/",
});

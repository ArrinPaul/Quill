const path = require("path");
// Load backend/.env if present, then fall back to the repo-root .env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const app = require("./app");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Quill backend running on port ${PORT}`);
});

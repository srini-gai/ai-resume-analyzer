import "dotenv/config";
import { app } from "./app.js";
import { runMigrations } from "./db.js";

const port = Number(process.env.PORT || 4000);

runMigrations()
  .then(() => {
    app.listen(port, () => console.log(`Resume analyzer API listening on port ${port}`));
  })
  .catch(err => {
    console.error("Failed to run database migrations:", err);
    // Still start the server — non-DB features will continue working
    app.listen(port, () => console.log(`Resume analyzer API listening on port ${port} (DB unavailable)`));
  });

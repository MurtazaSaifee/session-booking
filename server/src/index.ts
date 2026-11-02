import { createApp } from "./app.js";
import { createDb } from "./db.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const port = Number(process.env.PORT ?? 3000);
const app = createApp({ db: createDb(databaseUrl), now: () => new Date() });

app.listen(port, (err) => {
  if (err) throw err;
  console.log(`API listening on http://localhost:${port}`);
});

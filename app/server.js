const express = require("express");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "todo",
  password: process.env.DB_PASSWORD || "todo",
  database: process.env.DB_NAME || "todo",
});

const app = express();
app.use(express.json());
app.use(express.static("public"));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  });

app.get("/healthz", wrap(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
}));

app.get("/api/todos", wrap(async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM todos ORDER BY id");
  res.json(rows);
}));

app.post("/api/todos", wrap(async (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "title required" });
  const { rows } = await pool.query(
    "INSERT INTO todos (title) VALUES ($1) RETURNING *",
    [title]
  );
  res.status(201).json(rows[0]);
}));

app.put("/api/todos/:id", wrap(async (req, res) => {
  const { title, done } = req.body;
  const { rows } = await pool.query(
    `UPDATE todos SET title = COALESCE($1, title), done = COALESCE($2, done)
     WHERE id = $3 RETURNING *`,
    [title ?? null, done ?? null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
}));

app.delete("/api/todos/:id", wrap(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM todos WHERE id = $1", [
    req.params.id,
  ]);
  res.status(rowCount ? 204 : 404).end();
}));

// Simple schema bootstrap; use a migration tool (Flyway, Alembic, ...) for real projects.
async function init() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false
      )`);
      return;
    } catch (err) {
      console.log(`DB not ready (attempt ${attempt}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const port = process.env.PORT || 3000;
init().then(() =>
  app.listen(port, () => console.log(`listening on :${port}`))
);

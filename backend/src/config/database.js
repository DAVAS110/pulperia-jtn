const { Pool } = require("pg");

//prod
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

//Dev
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: false, // ✅ cambiar esto
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 10000,
// });

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

module.exports = { pool };

import "dotenv/config";
import { z } from "zod";
import { initializeDatabase, pool } from "./db.js";
import { createAdminUser, createApp } from "./app.js";

const configuration = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32)
}).safeParse(process.env);

if (!configuration.success) {
  console.error("Configuración inválida:", configuration.error.issues);
  process.exit(1);
}

const config = configuration.data;

try {
  await initializeDatabase();
  await createAdminUser();
  const app = createApp({ jwtSecret: process.env.JWT_SECRET, appOrigin: config.APP_ORIGIN });
  const server = app.listen(config.PORT, () => {
    console.log(`Orígenes SV API escuchando en http://localhost:${config.PORT}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error("No se pudo iniciar Orígenes SV:", error.message);
  await pool.end();
  process.exit(1);
}

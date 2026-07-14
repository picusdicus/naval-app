import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || "postgresql://neondb_owner:npg_rLuszGA1U2vV@ep-floral-band-asjaqtfn-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

try {
  const result = await sql`SELECT 1 as test`;
  console.log("✅ Conexión OK:", result);
} catch (err) {
  console.error("❌ Error de conexión:", err.message);
  console.error(err);
}
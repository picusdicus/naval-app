import { neon } from '@neondatabase/serverless';
export const config = { runtime: 'edge' };
const sql = neon(process.env.DATABASE_URL);
export default async function handler(req) {
  const result = await sql`SELECT 1 as test`;
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' }
  });
}

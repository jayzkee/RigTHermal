import { neon } from '@neondatabase/serverless';

export default async (req, context) => {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    return new Response(
      JSON.stringify({ ok: false, error: 'NEON_DATABASE_URL environment variable is missing.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const sql = neon(connectionString);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM builds ORDER BY created_at DESC LIMIT 20;`;
      return new Response(JSON.stringify({ ok: true, data: rows }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { name, cpu, gpu, total_wattage, btu_hr, monthly_cost } = body;

      const result = await sql`
        INSERT INTO builds (name, cpu, gpu, total_wattage, btu_hr, monthly_cost)
        VALUES (${name}, ${cpu}, ${gpu}, ${total_wattage}, ${btu_hr}, ${monthly_cost})
        RETURNING *;
      `;

      return new Response(
        JSON.stringify({ ok: true, id: result[0].id, row: result[0] }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

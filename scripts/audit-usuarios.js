const { Pool } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurada');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function auditarUsuarios() {
  try {
    console.log('🔍 Conectando a Neon...\n');

    // 1. Listar organizaciones
    const orgsResult = await pool.query(`
      SELECT id, nombre, slug, tier, activa
      FROM organizaciones
      ORDER BY creada_en DESC
    `);
    console.log('📋 ORGANIZACIONES EXISTENTES:');
    console.log('─'.repeat(80));
    orgsResult.rows.forEach((org) => {
      console.log(`ID: ${org.id}`);
      console.log(`  Nombre: ${org.nombre}`);
      console.log(`  Slug: ${org.slug}`);
      console.log(`  Tier: ${org.tier}`);
      console.log(`  Activa: ${org.activa}`);
      console.log('');
    });

    // 2. Auditar usuarios por org
    console.log('\n👥 USUARIOS EXISTENTES (agrupado por org):');
    console.log('─'.repeat(80));

    for (const org of orgsResult.rows) {
      const usuariosResult = await pool.query(`
        SELECT id, email, nombre, rol, activo, creado_en, ultimo_acceso_en
        FROM usuarios
        WHERE organizacion_id = $1
        ORDER BY creado_en DESC
      `, [org.id]);

      console.log(`\n🏛️  ${org.nombre} (${org.slug})`);
      if (usuariosResult.rows.length === 0) {
        console.log('   ⚠️  Sin usuarios');
      } else {
        console.log(`   Total: ${usuariosResult.rows.length} usuario(s)`);
        usuariosResult.rows.forEach((u, idx) => {
          console.log(`\n   [${idx + 1}] ${u.email}`);
          console.log(`       ID: ${u.id}`);
          console.log(`       Nombre: ${u.nombre}`);
          console.log(`       Rol: ${u.rol}`);
          console.log(`       Activo: ${u.activo}`);
          console.log(`       Creado: ${u.creado_en}`);
          console.log(`       Último acceso: ${u.ultimo_acceso_en || 'Nunca'}`);
        });
      }
    }

    // 3. Auditar códigos de invitación
    console.log('\n\n🎟️  CÓDIGOS DE INVITACIÓN EXISTENTES:');
    console.log('─'.repeat(80));

    const codigosResult = await pool.query(`
      SELECT id, codigo, organizacion_id, rol_concedido, usos_actuales, usos_maximos,
             expira_en, activo, creado_en
      FROM codigos_invitacion
      ORDER BY creado_en DESC
    `);

    if (codigosResult.rows.length === 0) {
      console.log('✅ Sin códigos de invitación pendientes');
    } else {
      console.log(`Total: ${codigosResult.rows.length} código(s)\n`);
      codigosResult.rows.forEach((c) => {
        const estado = !c.activo ? '❌ INACTIVO' : c.expira_en && new Date(c.expira_en) < new Date() ? '⏰ EXPIRADO' : '✅ ACTIVO';
        console.log(`${estado} | ${c.codigo}`);
        console.log(`     Org ID: ${c.organizacion_id}`);
        console.log(`     Rol: ${c.rol_concedido}`);
        console.log(`     Usos: ${c.usos_actuales}/${c.usos_maximos}`);
        console.log(`     Expira: ${c.expira_en || 'Sin expiración'}`);
        console.log('');
      });
    }

    console.log('\n✅ Auditoría completada\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante auditoría:', err.message);
    console.error(err);
    process.exit(1);
  }
}

auditarUsuarios();

// Helpers de la GitHub API compartidos por el cron de eventos y el panel
// superadmin de comercios. Módulo "neutro" (solo fetch + process.env): sirve
// tanto en handlers Node como Edge. El underscore evita que Vercel lo
// despliegue como endpoint.

function credenciales() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) return null
  const [owner, repo] = process.env.GITHUB_REPO.split('/')
  return {
    base: `https://api.github.com/repos/${owner}/${repo}`,
    cabeceras: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      // GitHub exige User-Agent en todas las peticiones; el fetch del runtime
      // Edge no envía ninguno por defecto.
      'User-Agent': 'NavalcarneroApp/0.1 (proyecto vecinal)',
    },
  }
}

// Texto de error útil de una respuesta fallida de la API de GitHub (incluye el
// `message` del cuerpo, p. ej. "Resource not accessible by personal access token").
async function detalleError(res, contexto) {
  let cuerpo = ''
  try {
    cuerpo = (await res.json())?.message || ''
  } catch {
    /* cuerpo no-JSON: se queda vacío */
  }
  return `${contexto}: ${res.status}${cuerpo ? ` — ${cuerpo.slice(0, 200)}` : ''}`
}

// Lee un archivo del repo (rama main) como texto crudo. null si no existe o
// si falta la configuración.
export async function leerArchivoRepo(ruta) {
  const cred = credenciales()
  if (!cred) return null
  const res = await fetch(`${cred.base}/contents/${ruta}?ref=main`, {
    headers: { ...cred.cabeceras, Accept: 'application/vnd.github.v3.raw' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API respondió ${res.status} al leer ${ruta}`)
  return res.text()
}

// Commit de uno o más archivos al repo en un ÚNICO commit (Git Data API).
// `archivos` = [{ path, contenido }] — solo los que han cambiado. Devuelve
// { ok, error } con el motivo real del fallo (para que el panel superadmin
// pueda mostrarlo); nunca lanza.
export async function commitArchivosConDetalle(archivos, mensaje) {
  if (!archivos.length) return { ok: false, error: 'No hay archivos que commitear.' }
  const cred = credenciales()
  if (!cred) {
    console.log('⚠️  No se pudo hacer commit: falta GITHUB_TOKEN o GITHUB_REPO')
    return { ok: false, error: 'Falta GITHUB_TOKEN o GITHUB_REPO.' }
  }
  const { base, cabeceras } = cred

  try {
    // Ref y árbol base actuales de main
    const refRes = await fetch(`${base}/git/refs/heads/main`, { headers: cabeceras })
    if (!refRes.ok) throw new Error(await detalleError(refRes, 'No se pudo obtener ref de main'))
    const mainSha = (await refRes.json()).object.sha

    const commitRes = await fetch(`${base}/git/commits/${mainSha}`, { headers: cabeceras })
    if (!commitRes.ok) throw new Error(await detalleError(commitRes, 'No se pudo obtener commit'))
    const treeSha = (await commitRes.json()).tree.sha

    // Un blob por archivo cambiado
    const tree = []
    for (const a of archivos) {
      const blobRes = await fetch(`${base}/git/blobs`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ content: a.contenido, encoding: 'utf-8' }),
      })
      if (!blobRes.ok) throw new Error(await detalleError(blobRes, `No se pudo crear blob (${a.path})`))
      tree.push({ path: a.path, mode: '100644', type: 'blob', sha: (await blobRes.json()).sha })
    }

    const treeRes = await fetch(`${base}/git/trees`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ base_tree: treeSha, tree }),
    })
    if (!treeRes.ok) throw new Error(await detalleError(treeRes, 'No se pudo crear árbol'))
    const nuevoTree = (await treeRes.json()).sha

    const newCommitRes = await fetch(`${base}/git/commits`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ message: mensaje, tree: nuevoTree, parents: [mainSha] }),
    })
    if (!newCommitRes.ok) throw new Error(await detalleError(newCommitRes, 'No se pudo crear commit'))
    const nuevoCommit = (await newCommitRes.json()).sha

    const updateRefRes = await fetch(`${base}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: cabeceras,
      body: JSON.stringify({ sha: nuevoCommit, force: false }),
    })
    if (!updateRefRes.ok) throw new Error(await detalleError(updateRefRes, 'No se pudo actualizar ref'))

    console.log(`✓ Commit a GitHub: ${archivos.map((a) => a.path).join(', ')}`)
    return { ok: true }
  } catch (err) {
    console.error('❌ Error al hacer commit:', err.message)
    return { ok: false, error: err.message }
  }
}

// Variante booleana (la usa el cron, fail-soft como siempre).
export async function commitArchivos(archivos, mensaje) {
  return (await commitArchivosConDetalle(archivos, mensaje)).ok
}

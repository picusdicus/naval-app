/**
 * Navega a una sección del panel de superadmin, funcione la suite en
 * escritorio o en móvil.
 *
 * En escritorio la navegación es la sidebar y están todas las secciones a la
 * vista; en móvil la barra inferior solo lleva cinco y el resto vive en el
 * drawer, que nace cerrado y NO existe en el DOM hasta que se abre. De ahí el
 * `if`: en escritorio no hace nada, en móvil abre el menú antes de buscar.
 *
 * Se busca DENTRO de `nav-superadmin` (la sidebar o el drawer, nunca las dos a
 * la vez) y no en toda la página: así el botón del mismo destino en la barra
 * inferior no compite. El nombre no se pide exacto porque los botones llevan
 * su contador en el nombre accesible ("Eventos (71 eventos publicados)"), que
 * cambia en cuanto llega el resumen.
 */
export async function irASeccion(page, etiqueta) {
  const nav = await abrirNavegacion(page)
  // En móvil, elegir sección cierra el drawer; en escritorio no hay nada que
  // cerrar. En los dos casos el panel queda en la sección pedida.
  await nav.getByRole('button', { name: etiqueta }).first().click()
}

/**
 * Deja a la vista la navegación con TODAS las secciones y la devuelve, para
 * los tests que además de navegar miran lo que hay en ella (los contadores).
 */
export async function abrirNavegacion(page) {
  const nav = page.getByTestId('nav-superadmin')
  const menu = page.getByRole('button', { name: 'Más secciones' })

  // Esperar primero a que el panel haya pintado la navegación que le toca a
  // este viewport; sin esto la comprobación de abajo puede correr antes de que
  // React monte nada y mandar a escritorio a buscar un botón que no existe.
  await nav.or(menu).first().waitFor()
  if (!(await nav.isVisible().catch(() => false))) await menu.click()
  return nav
}

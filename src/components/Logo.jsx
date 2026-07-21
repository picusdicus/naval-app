// Logotipo "La Gaceta": marca denominativa apilada en dos líneas con Archivo
// Black (font-logo). "EN" en tinta sobre "NAVALCARNERO" en acento. El acento
// es terracota sobre fondo claro y naranja sobre fondo oscuro (prop `sobre`).
// line-height ~0.8 y tracking negativo, como en la referencia.
export default function Logo({ sobre = 'claro', className = '', tamano = 'md' }) {
  const acento = sobre === 'oscuro' ? 'text-naranja' : 'text-terracota'
  const tinta = sobre === 'oscuro' ? 'text-papel' : 'text-tinta'
  const TAMANOS = {
    sm: 'text-[15px]',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }
  return (
    <span
      className={`font-logo leading-[0.8] tracking-[-0.02em] ${TAMANOS[tamano]} ${tinta} ${className}`}
      aria-label="En Navalcarnero"
    >
      EN
      <br />
      <span className={acento}>NAVALCARNERO</span>
    </span>
  )
}

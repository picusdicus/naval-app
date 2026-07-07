import { Link } from 'react-router-dom'
import { IconBell } from '../icons.jsx'

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-vino to-vino-dark text-crema">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-crema">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Navalcarnero</span>
        </Link>
        <button type="button" aria-label="Avisos" className="rounded-full p-1 text-crema/90 hover:text-crema">
          <IconBell className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import MenuDrawer from './MenuDrawer.jsx'
import NavBar from './NavBar.jsx'
import Footer from './Footer.jsx'

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header onAbrirMenu={() => setMenuAbierto(true)} />
      <main className="mx-auto w-full max-w-[1140px] flex-1 px-5 pb-28 pt-4 md:px-10 md:pb-16 md:pt-8">
        <Outlet />
      </main>
      <Footer />
      <NavBar />
      <MenuDrawer abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </div>
  )
}

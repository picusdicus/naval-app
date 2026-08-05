import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import MenuDrawer from './MenuDrawer.jsx'
import NavBar from './NavBar.jsx'
import Footer from './Footer.jsx'

export default function Layout({ onLogout }) {
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <Header onAbrirMenu={() => setMenuAbierto(true)} onLogout={onLogout} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-28 pt-4 md:px-10 md:pt-8 lg:pb-16">
        <Outlet />
      </main>
      <Footer />
      <NavBar />
      <MenuDrawer abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} onLogout={onLogout} />
    </div>
  )
}

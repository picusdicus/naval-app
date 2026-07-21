import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import MenuDrawer from './MenuDrawer.jsx'
import NavBar from './NavBar.jsx'
import Footer from './Footer.jsx'
import AsistenteChatPanel from './AsistenteChatPanel.jsx'

export default function Layout({ onLogout }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [chatAbierto, setChatAbierto] = useState(false)
  const abrirChat = () => setChatAbierto(true)

  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <Header onAbrirMenu={() => setMenuAbierto(true)} onAbrirChat={abrirChat} onLogout={onLogout} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-28 pt-4 md:px-10 md:pb-16 md:pt-8">
        <Outlet context={{ abrirChat }} />
      </main>
      <Footer onAbrirChat={abrirChat} />
      <NavBar />
      <MenuDrawer abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} onLogout={onLogout} />
      <AsistenteChatPanel abierto={chatAbierto} onCerrar={() => setChatAbierto(false)} />
    </div>
  )
}

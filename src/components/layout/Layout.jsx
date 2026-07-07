import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import NavBar from './NavBar.jsx'
import Footer from './Footer.jsx'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-crema">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-10 md:pt-8">
        <Outlet />
      </main>
      <Footer />
      <NavBar />
    </div>
  )
}

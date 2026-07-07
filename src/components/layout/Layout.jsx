import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import NavBar from './NavBar.jsx'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-crema">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <NavBar />
    </div>
  )
}

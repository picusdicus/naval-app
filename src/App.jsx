import { Routes, Route } from 'react-router-dom'
import ScrollManager from './components/ScrollManager.jsx'
import Layout from './components/layout/Layout.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import OfflineIndicator from './components/OfflineIndicator.jsx'
import Inicio from './pages/Inicio.jsx'
import Eventos from './pages/Eventos.jsx'
import EventoDetalle from './pages/EventoDetalle.jsx'
import Mapa from './pages/Mapa.jsx'
import Noticias from './pages/Noticias.jsx'
import NoticiaDetalle from './pages/NoticiaDetalle.jsx'
import Transporte from './pages/Transporte.jsx'
import Asistente from './pages/Asistente.jsx'

export default function App() {
  return (
    <>
      <ScrollManager />
      <OfflineIndicator />
      <InstallPrompt />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventoDetalle />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:id" element={<NoticiaDetalle />} />
          <Route path="/transporte" element={<Transporte />} />
          <Route path="/asistente" element={<Asistente />} />
        </Route>
      </Routes>
    </>
  )
}

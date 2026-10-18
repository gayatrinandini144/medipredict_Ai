import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Consult from './pages/Consult';
import Diseases from './pages/Diseases';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Consult />} />
          <Route path="/conditions" element={<Diseases />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="foot">
        MediPredict AI gives general information only. It is not a diagnosis. In an emergency, call your local emergency number.
      </footer>
    </>
  );
}

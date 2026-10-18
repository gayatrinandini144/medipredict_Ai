import { NavLink, Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link to="/" className="brand"><span className="pulse" aria-hidden="true" />MediPredict AI</Link>
        <nav className="links">
          <NavLink to="/" end>Check symptoms</NavLink>
          <NavLink to="/conditions">Conditions</NavLink>
        </nav>
      </div>
    </header>
  );
}

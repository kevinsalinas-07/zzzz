import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Form,
  FormGroup,
  Input,
  Label,
  Navbar,
  NavbarBrand,
  Row,
  Spinner
} from "reactstrap";
import { api } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Pos from "./pages/Pos.jsx";
import Inventory from "./pages/Inventory.jsx";
import Purchases from "./pages/Purchases.jsx";
import Cash from "./pages/Cash.jsx";
import Payroll from "./pages/Payroll.jsx";
import Security from "./pages/Security.jsx";

const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);

const navigation = [
  { to: "/", label: "Resumen", icon: "01" },
  { to: "/pos", label: "Punto de venta", icon: "02" },
  { to: "/inventario", label: "Inventario y recetas", icon: "03" },
  { to: "/compras", label: "Compras y proveedores", icon: "04" },
  { to: "/caja", label: "Caja y turnos", icon: "05" },
  { to: "/nomina", label: "Personal y nómina", icon: "06" },
  { to: "/seguridad", label: "Seguridad", icon: "07" }
];

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api("/auth/login", {
        method: "POST",
        token: null,
        body: { email, password }
      });
      localStorage.setItem("origenes-token", session.token);
      await onLogin(session.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <Card className="login-card">
        <CardBody>
          <div className="brand-mark">O</div>
          <p className="eyebrow">RESTAURANTE ORÍGENES SV</p>
          <h1>Un buen día empieza aquí.</h1>
          <p className="muted">Ingresa para administrar tus sucursales.</p>
          {error && <Alert color="danger">{error}</Alert>}
          <Form onSubmit={submit}>
            <FormGroup>
              <Label for="email">Correo</Label>
              <Input id="email" type="email" autoComplete="username" value={email}
                onChange={(event) => setEmail(event.target.value)} required />
            </FormGroup>
            <FormGroup>
              <Label for="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(event) => setPassword(event.target.value)} required />
            </FormGroup>
            <Button className="w-100 mt-2" color="success" disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Iniciar sesión"}
            </Button>
          </Form>
        </CardBody>
      </Card>
    </main>
  );
}

function Shell({ user, branches, branchId, onBranchChange, onLogout }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark brand-mark-small">O</div>
          <div>
            <strong>orígenes</strong>
            <span>ERP · EL SALVADOR</span>
          </div>
        </div>
        <p className="nav-caption">OPERACIÓN</p>
        <nav className="side-nav" aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) =>
              `side-link${isActive ? " active" : ""}`
            }>
              <span className="nav-number">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{user.name?.slice(0, 1).toUpperCase() || "A"}</div>
            <div className="user-info"><strong>{user.name}</strong><span>{user.role}</span></div>
          </div>
          <Button color="link" className="logout-button" onClick={onLogout}>Cerrar sesión</Button>
        </div>
      </aside>
      <div className="main-column">
        <Navbar className="topbar">
          <NavbarBrand className="mobile-brand"><span className="brand-mark brand-mark-small">O</span> orígenes</NavbarBrand>
          <div className="branch-picker">
            <span>SUCURSAL</span>
            <Input aria-label="Seleccionar sucursal" type="select" value={branchId || ""}
              onChange={(event) => onBranchChange(Number(event.target.value))}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Input>
          </div>
          <span className="topbar-date">{new Intl.DateTimeFormat("es-SV", { dateStyle: "full" }).format(new Date())}</span>
        </Navbar>
        <main className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<Pos />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/compras" element={<Purchases />} />
            <Route path="/caja" element={<Cash />} />
            <Route path="/nomina" element={<Payroll />} />
            <Route path="/seguridad" element={<Security />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">Orígenes SV · Gestión responsable, servicio excepcional</footer>
      </div>
    </div>
  );
}

function Workspace() {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(Number(localStorage.getItem("origenes-branch")) || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("origenes-token");
    if (!token) {
      setLoading(false);
      return;
    }

    Promise.all([api("/auth/me"), api("/branches")])
      .then(([currentUser, branchList]) => {
        setUser(currentUser);
        setBranches(branchList);
        const savedBranch = branchList.find((branch) => branch.id === branchId);
        const selectedBranch = savedBranch || branchList[0];
        if (selectedBranch) {
          setBranchId(selectedBranch.id);
          localStorage.setItem("origenes-branch", selectedBranch.id);
        }
      })
      .catch(() => {
        localStorage.removeItem("origenes-token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function acceptLogin(currentUser) {
    setUser(currentUser);
    try {
      const branchList = await api("/branches");
      setBranches(branchList);
      if (branchList[0]) {
        setBranchId(branchList[0].id);
        localStorage.setItem("origenes-branch", branchList[0].id);
      }
    } catch (error) {
      localStorage.removeItem("origenes-token");
      setUser(null);
      throw error;
    }
  }

  function changeBranch(nextBranchId) {
    setBranchId(nextBranchId);
    localStorage.setItem("origenes-branch", nextBranchId);
  }

  function logout() {
    localStorage.removeItem("origenes-token");
    setUser(null);
    setBranches([]);
  }

  const context = useMemo(() => ({ branchId, user }), [branchId, user]);

  if (loading) {
    return <div className="loading-screen"><Spinner color="success" /><span>Preparando tu espacio…</span></div>;
  }
  if (!user) return <Login onLogin={acceptLogin} />;
  if (!branches.length || !branchId) {
    return <Container className="py-5"><Alert color="warning">No hay sucursales activas configuradas.</Alert></Container>;
  }

  return (
    <WorkspaceContext.Provider value={context}>
      <Shell user={user} branches={branches} branchId={branchId} onBranchChange={changeBranch} onLogout={logout} />
    </WorkspaceContext.Provider>
  );
}

export default function App() {
  return <BrowserRouter><Workspace /></BrowserRouter>;
}

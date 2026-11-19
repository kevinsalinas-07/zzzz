import { useEffect, useState } from "react";
import {
  Alert, Button, Card, CardBody, Col, Form, FormGroup, Input, Label, Row, Spinner, Table
} from "reactstrap";
import { api, formatDate, formatMoney } from "../api.js";
import { useWorkspace } from "../App.jsx";

function dateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentFortnight() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (now.getDate() <= 15) {
    return { start: dateInput(new Date(year, month, 1)), end: dateInput(new Date(year, month, 15)) };
  }
  return { start: dateInput(new Date(year, month, 16)), end: dateInput(new Date(year, month + 1, 0)) };
}

export default function Payroll() {
  const { branchId } = useWorkspace();
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [period, setPeriod] = useState(currentFortnight);
  const [employee, setEmployee] = useState({ fullName: "", position: "", monthlySalary: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState(null);

  async function loadData() {
    const [employeeList, payrollList] = await Promise.all([api(`/employees?branchId=${branchId}`), api("/payroll")]);
    setEmployees(employeeList);
    setRuns(payrollList);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    loadData()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  async function addEmployee(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/employees", {
        method: "POST",
        body: { ...employee, branchId, monthlySalary: Number(employee.monthlySalary) }
      });
      setEmployee({ fullName: "", position: "", monthlySalary: "" });
      setMessage("Empleado registrado correctamente.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function generatePayroll(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setGenerated(null);
    try {
      const payroll = await api("/payroll", {
        method: "POST",
        body: { branchId, periodStart: period.start, periodEnd: period.end }
      });
      setGenerated(payroll);
      setMessage(`Planilla quincenal generada para ${payroll.lines.length} colaboradores.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">EQUIPO</p><h1>Personal y nómina</h1>
        <p>Administra el equipo y calcula planillas quincenales.</p></div></div>
      {error && <Alert color="danger">{error}</Alert>}
      {message && <Alert color="success" toggle={() => setMessage("")}>{message}</Alert>}
      <Row className="g-3 align-items-start">
        <Col xl="5">
          <Card className="surface-card mb-3"><CardBody>
            <p className="eyebrow">NUEVO COLABORADOR</p><h2 className="section-title">Registrar empleado</h2>
            <Form onSubmit={addEmployee}>
              <FormGroup><Label for="fullName">Nombre completo</Label>
                <Input id="fullName" value={employee.fullName} onChange={(event) => setEmployee({ ...employee, fullName: event.target.value })} required minLength="2" maxLength="160" /></FormGroup>
              <FormGroup><Label for="position">Puesto</Label>
                <Input id="position" value={employee.position} onChange={(event) => setEmployee({ ...employee, position: event.target.value })} required minLength="2" maxLength="100" placeholder="Barista, cajero, gerente…" /></FormGroup>
              <FormGroup><Label for="salary">Salario mensual (USD)</Label>
                <Input id="salary" type="number" min="0.01" step="0.01" value={employee.monthlySalary} onChange={(event) => setEmployee({ ...employee, monthlySalary: event.target.value })} required /></FormGroup>
              <Button color="success" className="w-100" disabled={busy}>{busy ? <Spinner size="sm" /> : "Guardar empleado"}</Button>
            </Form>
          </CardBody></Card>
          <Card className="surface-card"><CardBody>
            <p className="eyebrow">NÓMINA</p><h2 className="section-title">Generar quincena</h2>
            <Form onSubmit={generatePayroll}>
              <Row className="g-2">
                <Col xs="6"><FormGroup><Label for="periodStart">Desde</Label>
                  <Input id="periodStart" type="date" value={period.start} onChange={(event) => setPeriod({ ...period, start: event.target.value })} required /></FormGroup></Col>
                <Col xs="6"><FormGroup><Label for="periodEnd">Hasta</Label>
                  <Input id="periodEnd" type="date" value={period.end} onChange={(event) => setPeriod({ ...period, end: event.target.value })} required /></FormGroup></Col>
              </Row>
              <Button color="dark" className="w-100" disabled={busy || !employees.length}>
                {busy ? <Spinner size="sm" /> : "Calcular planilla"}
              </Button>
              {!employees.length && <small className="muted d-block mt-2">Primero registra al menos un empleado activo.</small>}
            </Form>
          </CardBody></Card>
        </Col>
        <Col xl="7">
          <Card className="surface-card mb-3"><CardBody>
            <p className="eyebrow">PERSONAL ACTIVO</p><h2 className="section-title">{employees.length} colaboradores</h2>
            {loading ? <Spinner color="success" /> : (
              <div className="table-responsive"><Table hover className="data-table align-middle mb-0">
                <thead><tr><th>Nombre</th><th>Puesto</th><th>Salario mensual</th></tr></thead>
                <tbody>{employees.map((item) => <tr key={item.id}><td className="table-primary">{item.fullName}</td>
                  <td>{item.position}</td><td>{formatMoney(item.monthlySalary)}</td></tr>)}
                  {!employees.length && <tr><td colSpan="3" className="text-center muted py-3">Sin empleados registrados.</td></tr>}
                </tbody>
              </Table></div>
            )}
          </CardBody></Card>
          {generated && <Card className="surface-card mb-3"><CardBody>
            <p className="eyebrow">RESULTADO DE PLANILLA</p>
            <h2 className="section-title">{formatDate(generated.periodStart)} — {formatDate(generated.periodEnd)}</h2>
            <div className="table-responsive"><Table className="data-table align-middle mb-0">
              <thead><tr><th>Colaborador</th><th>Bruto</th><th>ISSS 3%</th><th>AFP 7.25%</th><th>ISR</th><th>Neto</th></tr></thead>
              <tbody>{generated.lines.map((line) => <tr key={line.employee}>
                <td className="table-primary">{line.employee}</td><td>{formatMoney(line.gross)}</td>
                <td>{formatMoney(line.isss)}</td><td>{formatMoney(line.afp)}</td>
                <td>{formatMoney(line.incomeTax)}</td><td><strong>{formatMoney(line.net)}</strong></td>
              </tr>)}</tbody>
            </Table></div>
          </CardBody></Card>}
          <Card className="surface-card"><CardBody>
            <p className="eyebrow">HISTORIAL</p><h2 className="section-title">Planillas generadas</h2>
            {loading ? <Spinner color="success" /> : (
              <div className="table-responsive"><Table hover className="data-table align-middle mb-0">
                <thead><tr><th>Período</th><th>Empleados</th><th>Total bruto</th><th>Total neto</th></tr></thead>
                <tbody>{runs.map((run) => <tr key={run.id}><td>{formatDate(run.periodStart)} — {formatDate(run.periodEnd)}</td>
                  <td>{run.employees}</td><td>{formatMoney(run.gross)}</td><td>{formatMoney(run.net)}</td></tr>)}
                  {!runs.length && <tr><td colSpan="4" className="text-center muted py-3">Aún no hay planillas.</td></tr>}
                </tbody>
              </Table></div>
            )}
          </CardBody></Card>
        </Col>
      </Row>
      <div className="info-note mt-3">Configuración base: ISSS 3%, AFP 7.25% y tabla quincenal ISR. Verifica los límites vigentes y la base imponible con la normativa y asesoría contable local antes de usarla para pago real.</div>
    </div>
  );
}

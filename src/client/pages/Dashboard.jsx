import { useEffect, useState } from "react";
import { Alert, Card, CardBody, Col, Row, Spinner } from "reactstrap";
import { api, formatMoney } from "../api.js";
import { useWorkspace } from "../App.jsx";

const metrics = [
  { key: "todayRevenue", label: "Ventas de hoy", icon: "$", format: formatMoney },
  { key: "todayOrders", label: "Pedidos completados", icon: "↗", format: (value) => value },
  { key: "lowStockCount", label: "Alertas de inventario", icon: "!", format: (value) => value },
  { key: "outstandingPayables", label: "Cuentas por pagar", icon: "↘", format: formatMoney }
];

export default function Dashboard() {
  const { branchId } = useWorkspace();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSummary(null);
    setError("");
    api(`/dashboard?branchId=${branchId}`)
      .then(setSummary)
      .catch((requestError) => setError(requestError.message));
  }, [branchId]);

  return (
    <div>
      <div className="page-heading">
        <div><p className="eyebrow">PANEL DE CONTROL</p><h1>Buenos días.</h1>
          <p>Este es el pulso de tu restaurante hoy.</p></div>
        <div className="date-pill">● <span>Sucursal activa</span></div>
      </div>
      {error && <Alert color="danger">{error}</Alert>}
      {!summary && !error && <Spinner color="success" />}
      {summary && (
        <>
          <Row className="g-3 mb-4">
            {metrics.map((metric, index) => (
              <Col key={metric.key} xs="12" sm="6" xl="3">
                <Card className={`metric-card metric-${index}`}><CardBody>
                  <div className="metric-top"><span>{metric.label}</span><b>{metric.icon}</b></div>
                  <div className="metric-value">{metric.format(summary[metric.key])}</div>
                  <div className="metric-note">Información de la sucursal seleccionada</div>
                </CardBody></Card>
              </Col>
            ))}
          </Row>
          <Row className="g-3">
            <Col lg="7">
              <Card className="surface-card h-100"><CardBody>
                <p className="eyebrow">OPERACIÓN</p><h2 className="section-title">Inicio de turno</h2>
                {summary.cashShift ? (
                  <div className="status-block">
                    <span className="status-dot" />
                    <div><strong>Caja abierta</strong><p>El equipo puede registrar pedidos y pagos.</p></div>
                  </div>
                ) : (
                  <div className="status-block status-warn">
                    <span className="status-dot" />
                    <div><strong>La caja está cerrada</strong><p>Abre un turno desde “Caja y turnos” antes de realizar ventas.</p></div>
                  </div>
                )}
              </CardBody></Card>
            </Col>
            <Col lg="5">
              <Card className="tip-card h-100"><CardBody>
                <p className="eyebrow">RECOMENDACIÓN</p>
                <h2 className="section-title">Cuida cada ingrediente.</h2>
                <p>Las recetas descuentan insumos automáticamente. Revisa las alertas antes de iniciar la preparación.</p>
              </CardBody></Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

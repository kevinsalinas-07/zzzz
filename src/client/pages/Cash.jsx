import { useEffect, useState } from "react";
import {
  Alert, Button, Card, CardBody, Col, Form, FormGroup, Input, Label, Row, Spinner
} from "reactstrap";
import { api, formatMoney, formatDate } from "../api.js";
import { useWorkspace } from "../App.jsx";

const paymentFields = [
  ["countedCash", "Efectivo contado"],
  ["countedCard", "Tarjetas"],
  ["countedBitcoin", "Bitcoin"],
  ["countedChivo", "Chivo Wallet"]
];

export default function Cash() {
  const { branchId } = useWorkspace();
  const [status, setStatus] = useState(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [counts, setCounts] = useState({
    countedCash: "0", countedCard: "0", countedBitcoin: "0", countedChivo: "0"
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function refresh() {
    const data = await api(`/cash/status?branchId=${branchId}`);
    setStatus(data);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    refresh()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  async function openShift(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/cash/open", { method: "POST", body: { branchId, openingAmount: Number(openingAmount) } });
      setOpeningAmount("");
      setResult(null);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeShift(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const closeResult = await api("/cash/close", {
        method: "POST",
        body: {
          branchId,
          countedCash: Number(counts.countedCash),
          countedCard: Number(counts.countedCard),
          countedBitcoin: Number(counts.countedBitcoin),
          countedChivo: Number(counts.countedChivo)
        }
      });
      setResult(closeResult);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const shift = status?.shift;
  const totals = status?.totals || {};
  const expectedCash = Number(shift?.openingAmount || 0) + Number(totals.CASH || 0);
  const expected = {
    countedCash: expectedCash,
    countedCard: Number(totals.CARD || 0),
    countedBitcoin: Number(totals.BITCOIN || 0),
    countedChivo: Number(totals.CHIVO || 0)
  };

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">CONTROL FINANCIERO</p><h1>Caja y turnos</h1>
        <p>Abre, monitorea y cuadra los medios de pago por turno.</p></div></div>
      {error && <Alert color="danger">{error}</Alert>}
      {result && <Alert color={Object.values(result.differences).some((amount) => Math.abs(amount) > 0.009) ? "warning" : "success"}
        toggle={() => setResult(null)}>
        <div>Turno cerrado. Diferencia neta: <strong>{formatMoney(result.difference)}</strong>.</div>
        <small>Desglose — efectivo {formatMoney(result.differences.CASH)}, tarjeta {formatMoney(result.differences.CARD)},
          Bitcoin {formatMoney(result.differences.BITCOIN)}, Chivo {formatMoney(result.differences.CHIVO)}.</small>
      </Alert>}
      {loading ? <Spinner color="success" /> : (
        <Row className="g-3">
          <Col lg="5">
            <Card className="surface-card"><CardBody>
              <p className="eyebrow">TURNO ACTUAL</p>
              <h2 className="section-title">{shift ? "Caja abierta" : "Caja cerrada"}</h2>
              {shift ? (
                <>
                  <div className="shift-meta"><span>Abierta</span><strong>{formatDate(shift.openedAt)}</strong></div>
                  <div className="shift-meta"><span>Fondo inicial</span><strong>{formatMoney(shift.openingAmount)}</strong></div>
                  <div className="payment-summary">
                    {[["Efectivo vendido", totals.CASH], ["Tarjetas", totals.CARD], ["Bitcoin", totals.BITCOIN], ["Chivo Wallet", totals.CHIVO]]
                      .map(([label, amount]) => <div key={label}><span>{label}</span><strong>{formatMoney(amount)}</strong></div>)}
                  </div>
                  <div className="info-note mt-3">Efectivo esperado: <strong>{formatMoney(expectedCash)}</strong>. Los demás saldos se cuadran individualmente.</div>
                </>
              ) : (
                <Form onSubmit={openShift}>
                  <FormGroup><Label for="openingAmount">Fondo inicial de efectivo</Label>
                    <Input id="openingAmount" type="number" min="0" step="0.01" value={openingAmount}
                      onChange={(event) => setOpeningAmount(event.target.value)} required /></FormGroup>
                  <Button color="success" className="w-100" disabled={busy}>
                    {busy ? <Spinner size="sm" /> : "Abrir turno"}
                  </Button>
                </Form>
              )}
            </CardBody></Card>
          </Col>
          <Col lg="7">
            {shift ? (
              <Card className="surface-card"><CardBody>
                <p className="eyebrow">CIERRE DE TURNO</p><h2 className="section-title">Cuadratura de caja</h2>
                <Form onSubmit={closeShift}>
                  <Row className="g-2">
                    {paymentFields.map(([key, label]) => (
                      <Col sm="6" key={key}><FormGroup><Label for={key}>{label}</Label>
                        <Input id={key} type="number" min="0" step="0.01" value={counts[key]}
                          onChange={(event) => setCounts((current) => ({ ...current, [key]: event.target.value }))} required />
                        <small className="muted">Esperado: {formatMoney(expected[key])}</small>
                      </FormGroup></Col>
                    ))}
                  </Row>
                  <Button color="dark" className="w-100 mt-2" disabled={busy}>
                    {busy ? <Spinner size="sm" /> : "Cerrar turno y guardar diferencias"}
                  </Button>
                </Form>
              </CardBody></Card>
            ) : (
              <Card className="tip-card h-100"><CardBody>
                <p className="eyebrow">CUADRATURA</p><h2 className="section-title">Cada medio, por separado.</h2>
                <p>El cierre compara efectivo, tarjeta, Bitcoin y Chivo Wallet con los pagos de las ventas registradas durante el turno.</p>
              </CardBody></Card>
            )}
          </Col>
        </Row>
      )}
    </div>
  );
}

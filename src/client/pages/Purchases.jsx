import { useEffect, useMemo, useState } from "react";
import {
  Alert, Button, Card, CardBody, Col, Form, FormGroup, Input, Label, Row, Spinner, Table
} from "reactstrap";
import { api, formatDate, formatMoney } from "../api.js";
import { useWorkspace } from "../App.jsx";

const today = new Date().toISOString().slice(0, 10);
const emptyLine = { itemId: "", quantity: "1", unitCost: "" };

export default function Purchases() {
  const { branchId } = useWorkspace();
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [dueAt, setDueAt] = useState(today);
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    const [supplierList, stock, purchaseList] = await Promise.all([
      api("/suppliers"),
      api(`/inventory?branchId=${branchId}`),
      api(`/purchases?branchId=${branchId}`)
    ]);
    setSuppliers(supplierList);
    setInventory(stock);
    setPurchases(purchaseList);
    if (!supplierId && supplierList[0]) setSupplierId(String(supplierList[0].id));
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    loadData()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const selectedItems = useMemo(() => inventory.map((item) => ({
    value: `${item.type}:${item.id}`,
    label: `${item.name} (${item.unit})`,
    type: item.type,
    id: item.id
  })), [inventory]);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);

  function updateLine(index, key, value) {
    setLines((current) => current.map((line, lineIndex) =>
      lineIndex === index ? { ...line, [key]: value } : line
    ));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const items = lines.map((line) => {
        const [type, id] = line.itemId.split(":");
        return {
          ...(type === "INGREDIENT" ? { ingredientId: Number(id) } : { productId: Number(id) }),
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost)
        };
      });
      const result = await api("/purchases", {
        method: "POST",
        body: { branchId, supplierId: Number(supplierId), supplierInvoice, purchasedAt, dueAt, items }
      });
      setMessage(`Compra #${result.id} registrada. Cuenta por pagar: ${formatMoney(result.total)}.`);
      setSupplierInvoice("");
      setLines([{ ...emptyLine }]);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">ABASTECIMIENTO</p><h1>Compras y proveedores</h1>
        <p>Registra facturas y actualiza las existencias de forma automática.</p></div></div>
      {error && <Alert color="danger">{error}</Alert>}
      {message && <Alert color="success" toggle={() => setMessage("")}>{message}</Alert>}
      <Row className="g-3 align-items-start">
        <Col xl="5">
          <Card className="surface-card"><CardBody>
            <p className="eyebrow">NUEVA FACTURA</p><h2 className="section-title">Registrar compra</h2>
            {loading ? <Spinner color="success" /> : (
              <Form onSubmit={submit}>
                <Row className="g-2">
                  <Col xs="12"><FormGroup><Label for="supplier">Proveedor</Label>
                    <Input id="supplier" type="select" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
                      <option value="">Selecciona proveedor</option>
                      {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                    </Input></FormGroup></Col>
                  <Col xs="12"><FormGroup><Label for="invoice">Número de factura del proveedor</Label>
                    <Input id="invoice" value={supplierInvoice} onChange={(event) => setSupplierInvoice(event.target.value)} required maxLength="80" /></FormGroup></Col>
                  <Col xs="6"><FormGroup><Label for="purchasedAt">Fecha de compra</Label>
                    <Input id="purchasedAt" type="date" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)} required /></FormGroup></Col>
                  <Col xs="6"><FormGroup><Label for="dueAt">Vencimiento</Label>
                    <Input id="dueAt" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required /></FormGroup></Col>
                </Row>
                <div className="line-items-heading"><strong>Detalle de la factura</strong>
                  <Button type="button" color="link" onClick={() => setLines((current) => [...current, { ...emptyLine }])}>+ Línea</Button>
                </div>
                {lines.map((line, index) => (
                  <div className="purchase-line" key={index}>
                    <Input aria-label="Artículo" type="select" value={line.itemId}
                      onChange={(event) => updateLine(index, "itemId", event.target.value)} required>
                      <option value="">Seleccionar artículo</option>
                      {selectedItems.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Input>
                    <Input aria-label="Cantidad" type="number" step="0.001" min="0.001" placeholder="Cantidad"
                      value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} required />
                    <Input aria-label="Costo unitario" type="number" step="0.0001" min="0" placeholder="Costo unit."
                      value={line.unitCost} onChange={(event) => updateLine(index, "unitCost", event.target.value)} required />
                    {lines.length > 1 && <Button type="button" color="light" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} aria-label="Quitar línea">×</Button>}
                  </div>
                ))}
                <div className="totals purchase-totals">
                  <div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
                  <div><span>IVA estimado (13%)</span><strong>{formatMoney(subtotal * 0.13)}</strong></div>
                  <div className="total-line"><span>Total por pagar</span><strong>{formatMoney(subtotal * 1.13)}</strong></div>
                </div>
                <Button color="success" className="w-100" disabled={busy || !suppliers.length || !selectedItems.length}>
                  {busy ? <Spinner size="sm" /> : "Registrar compra y actualizar inventario"}
                </Button>
              </Form>
            )}
          </CardBody></Card>
        </Col>
        <Col xl="7">
          <Card className="surface-card"><CardBody>
            <p className="eyebrow">HISTORIAL</p><h2 className="section-title">Facturas y cuentas por pagar</h2>
            {loading ? <Spinner color="success" /> : (
              <div className="table-responsive">
                <Table hover className="data-table align-middle mb-0">
                  <thead><tr><th>Proveedor</th><th>Factura</th><th>Fecha</th><th>Vence</th><th>Total</th><th>Saldo</th></tr></thead>
                  <tbody>{purchases.map((purchase) => (
                    <tr key={purchase.id}><td className="table-primary">{purchase.supplier}</td>
                      <td>{purchase.supplierInvoice}</td><td>{formatDate(purchase.purchasedAt)}</td>
                      <td>{formatDate(purchase.dueAt)}</td><td>{formatMoney(purchase.total)}</td>
                      <td>{formatMoney(purchase.outstanding)}</td></tr>
                  ))}
                  {!purchases.length && <tr><td colSpan="6" className="text-center muted py-4">Aún no hay compras registradas.</td></tr>}</tbody>
                </Table>
              </div>
            )}
          </CardBody></Card>
          <div className="info-note mt-3">Cada factura crea una cuenta por pagar y registra entradas de insumos o productos empacados en la sucursal.</div>
        </Col>
      </Row>
    </div>
  );
}

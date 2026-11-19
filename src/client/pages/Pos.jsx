import { useEffect, useMemo, useState } from "react";
import {
  Alert, Badge, Button, Card, CardBody, Col, FormGroup, Input, Label, Row, Spinner
} from "reactstrap";
import { api, formatMoney } from "../api.js";
import { useWorkspace } from "../App.jsx";

const methods = [
  ["CASH", "Efectivo"],
  ["CARD", "Tarjeta"],
  ["BITCOIN", "Bitcoin"],
  ["CHIVO", "Chivo Wallet"]
];

export default function Pos() {
  const { branchId } = useWorkspace();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [documentType, setDocumentType] = useState("CONSUMER_FINAL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    setLoading(true);
    api("/products")
      .then(setProducts)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const cartItems = useMemo(() => Object.entries(cart)
    .map(([id, quantity]) => ({ product: products.find((item) => item.id === Number(id)), quantity }))
    .filter((item) => item.product), [cart, products]);
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const tax = subtotal * 0.13;
  const total = subtotal + tax;

  function updateQuantity(productId, amount) {
    setReceipt(null);
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[productId] || 0) + amount;
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  async function submitSale() {
    setBusy(true);
    setError("");
    setReceipt(null);
    try {
      const result = await api("/sales", {
        method: "POST",
        body: {
          branchId,
          documentType,
          paymentMethod,
          items: cartItems.map(({ product, quantity }) => ({ productId: product.id, quantity }))
        }
      });
      setReceipt(result);
      setCart({});
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">VENTAS</p><h1>Punto de venta</h1>
        <p>Agrega productos, cobra y genera el comprobante.</p></div><Badge className="vat-badge">IVA 13%</Badge></div>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {receipt && <Alert color="success" toggle={() => setReceipt(null)}>
        Venta registrada · <strong>{receipt.invoice}</strong> · Total {formatMoney(receipt.total)}
      </Alert>}
      {loading ? <Spinner color="success" /> : (
        <Row className="g-3 align-items-start">
          <Col xl="8">
            <div className="product-grid">
              {products.map((product) => (
                <Card key={product.id} className="product-card">
                  <CardBody>
                    <span className="product-category">{product.category}</span>
                    <h2>{product.name}</h2>
                    <div className="product-bottom"><strong>{formatMoney(product.price)}</strong>
                      <Button color="success" outline size="sm" onClick={() => updateQuantity(product.id, 1)}
                        aria-label={`Agregar ${product.name}`}>+ Agregar</Button></div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </Col>
          <Col xl="4">
            <Card className="surface-card cart-card"><CardBody>
              <p className="eyebrow">PEDIDO ACTUAL</p><h2 className="section-title">Tu orden</h2>
              <div className="cart-items">
                {cartItems.length === 0 && <p className="muted py-3">Selecciona un producto para comenzar.</p>}
                {cartItems.map(({ product, quantity }) => (
                  <div className="cart-line" key={product.id}>
                    <div><strong>{product.name}</strong><span>{formatMoney(product.price)} c/u</span></div>
                    <div className="quantity-control">
                      <Button size="sm" color="light" onClick={() => updateQuantity(product.id, -1)} aria-label="Quitar uno">−</Button>
                      <span>{quantity}</span>
                      <Button size="sm" color="light" onClick={() => updateQuantity(product.id, 1)} aria-label="Agregar uno">+</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="totals">
                <div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
                <div><span>IVA (13%)</span><strong>{formatMoney(tax)}</strong></div>
                <div className="total-line"><span>Total a cobrar</span><strong>{formatMoney(total)}</strong></div>
              </div>
              <FormGroup>
                <Label for="documentType">Comprobante</Label>
                <Input id="documentType" type="select" value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}>
                  <option value="CONSUMER_FINAL">Factura consumidor final</option>
                  <option value="CCF">Comprobante de crédito fiscal (CCF)</option>
                </Input>
              </FormGroup>
              <FormGroup>
                <Label for="paymentMethod">Forma de pago</Label>
                <Input id="paymentMethod" type="select" value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}>
                  {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Input>
              </FormGroup>
              <Button color="success" className="w-100" disabled={!cartItems.length || busy} onClick={submitSale}>
                {busy ? <Spinner size="sm" /> : "Cobrar y emitir factura"}
              </Button>
              <small className="muted d-block mt-2">Los precios se muestran antes de IVA.</small>
            </CardBody></Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

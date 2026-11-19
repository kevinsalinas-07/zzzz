import { useEffect, useState } from "react";
import { Alert, Badge, Card, CardBody, Spinner, Table } from "reactstrap";
import { api } from "../api.js";
import { useWorkspace } from "../App.jsx";

export default function Inventory() {
  const { branchId } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/inventory?branchId=${branchId}`)
      .then(setRows)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const lowStock = rows.filter((item) => item.lowStock).length;
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">CONTROL DE INSUMOS</p><h1>Inventario y recetas</h1>
        <p>Existencias por sucursal y avisos para reabastecer.</p></div>
        <Badge className={lowStock ? "alert-badge" : "ok-badge"}>{lowStock} alertas</Badge></div>
      {error && <Alert color="danger">{error}</Alert>}
      <Card className="surface-card"><CardBody>
        {loading ? <Spinner color="success" /> : (
          <div className="table-responsive">
            <Table hover className="data-table align-middle mb-0">
              <thead><tr><th>Artículo</th><th>Tipo</th><th>Unidad</th><th>Existencia</th><th>Mínimo</th><th>Estado</th></tr></thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td className="table-primary">{item.name}</td>
                    <td>{item.type === "INGREDIENT" ? "Insumo / receta" : "Producto empacado"}</td>
                    <td>{item.unit}</td>
                    <td>{Number(item.quantity).toLocaleString("es-SV")}</td>
                    <td>{Number(item.minimumStock).toLocaleString("es-SV")}</td>
                    <td><Badge className={item.lowStock ? "alert-badge" : "ok-badge"}>
                      {item.lowStock ? "Reabastecer" : "Disponible"}
                    </Badge></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan="6" className="text-center muted py-4">Sin existencias registradas.</td></tr>}
              </tbody>
            </Table>
          </div>
        )}
      </CardBody></Card>
      <div className="info-note mt-3"><strong>Descuento automático:</strong> las recetas de bebidas y alimentos consumen los insumos definidos al registrar cada venta. Los productos empacados se rebajan por unidad.</div>
    </div>
  );
}

import { useState } from "react";
import { Alert, Button, Card, CardBody, Form, FormGroup, Input, Label, Spinner } from "reactstrap";
import { api } from "../api.js";

export default function Security() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setBusy(true);
    try {
      const result = await api("/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword }
      });
      localStorage.setItem("origenes-token", result.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Contraseña actualizada. Se cerraron las demás sesiones.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CUENTA</p>
          <h1>Seguridad</h1>
          <p>Actualiza la contraseña de tu cuenta.</p>
        </div>
      </div>
      <Card className="surface-card password-card">
        <CardBody>
          <p className="eyebrow">CAMBIAR CONTRASEÑA</p>
          <h2 className="section-title">Protege tu acceso</h2>
          <p className="muted mb-4">Usa al menos 12 caracteres. El cambio cerrará las sesiones de otros dispositivos.</p>
          {error && <Alert color="danger">{error}</Alert>}
          {success && <Alert color="success">{success}</Alert>}
          <Form onSubmit={submit}>
            <FormGroup>
              <Label for="current-password">Contraseña actual</Label>
              <Input id="current-password" type="password" autoComplete="current-password"
                value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </FormGroup>
            <FormGroup>
              <Label for="new-password">Nueva contraseña</Label>
              <Input id="new-password" type="password" autoComplete="new-password"
                value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                minLength={12} maxLength={200} required />
            </FormGroup>
            <FormGroup>
              <Label for="confirm-password">Confirmar nueva contraseña</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password"
                value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={12} maxLength={200} required />
            </FormGroup>
            <Button color="success" disabled={busy}>
              {busy ? <><Spinner size="sm" /> Guardando…</> : "Actualizar contraseña"}
            </Button>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}

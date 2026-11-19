import jwt from "jsonwebtoken";
import { pool } from "./db.js";

export function createToken(user, secret) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      name: user.full_name,
      ver: user.session_version ?? 0
    },
    secret,
    { expiresIn: "8h", issuer: "origenes-sv-erp" }
  );
}

export function authenticate(secret) {
  return (req, res, next) => {
    const authorization = req.get("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Debe iniciar sesión para continuar." });
    }

    try {
      req.user = jwt.verify(authorization.slice(7), secret, {
        issuer: "origenes-sv-erp"
      });
    } catch (error) {
      if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "La sesión no es válida o ha expirado." });
      }
      return next(error);
    }

    pool.query(
      "SELECT session_version FROM users WHERE id = $1 AND active = TRUE",
      [req.user.sub]
    ).then((result) => {
      const currentVersion = result.rows[0]?.session_version;
      if (currentVersion === undefined || Number(currentVersion) !== Number(req.user.ver ?? 0)) {
        return res.status(401).json({ error: "La sesión no es válida o ha expirado." });
      }
      next();
    }).catch(next);
  };
}

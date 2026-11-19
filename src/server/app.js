import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool, inTransaction } from "./db.js";
import { authenticate, createToken } from "./auth.js";
import {
  calculatePayroll,
  calculateRecipeRequirements,
  calculateSaleTotals,
  reconcileCash,
  roundMoney,
  roundQuantity
} from "./domain.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const idSchema = z.coerce.number().int().positive();
const moneySchema = z.coerce.number().finite().nonnegative();
const paymentMethods = ["CASH", "CARD", "BITCOIN", "CHIVO"];
const purchaseSchema = z.object({
  branchId: idSchema,
  supplierId: idSchema,
  supplierInvoice: z.string().trim().min(1).max(80),
  purchasedAt: z.string().date(),
  dueAt: z.string().date(),
  items: z.array(z.object({
    ingredientId: idSchema.optional(),
    productId: idSchema.optional(),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().nonnegative()
  }).refine((item) => Boolean(item.ingredientId) !== Boolean(item.productId), {
    message: "Cada línea debe referir a un insumo o producto empacado, no ambos."
  })).min(1)
}).refine((purchase) => purchase.dueAt >= purchase.purchasedAt, {
  path: ["dueAt"],
  message: "El vencimiento no puede ser anterior a la fecha de compra."
});

const payrollSchema = z.object({
  branchId: idSchema,
  periodStart: z.string().date(),
  periodEnd: z.string().date()
}).superRefine((period, context) => {
  if (period.periodEnd < period.periodStart) {
    context.addIssue({
      code: "custom",
      path: ["periodEnd"],
      message: "La fecha final debe ser igual o posterior a la inicial."
    });
    return;
  }
  const start = new Date(`${period.periodStart}T00:00:00.000Z`);
  const end = new Date(`${period.periodEnd}T00:00:00.000Z`);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear()
    && start.getUTCMonth() === end.getUTCMonth();
  const isQuincena = sameMonth
    && ((start.getUTCDate() === 1 && end.getUTCDate() === 15)
      || (start.getUTCDate() === 16 && end.getUTCDate() === lastDay));

  if (!isQuincena) {
    context.addIssue({
      code: "custom",
      path: ["periodEnd"],
      message: "Use una quincena completa: del 1 al 15 o del 16 al último día del mismo mes."
    });
  }
});

function parseOrRespond(schema, input, res) {
  const result = schema.safeParse(input);
  if (!result.success) {
    res.status(400).json({
      error: "Revise los datos enviados.",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
    return null;
  }
  return result.data;
}

function requireId(value, res, label = "identificador") {
  const id = idSchema.safeParse(value);
  if (!id.success) {
    res.status(400).json({ error: `El ${label} no es válido.` });
    return null;
  }
  return id.data;
}

function handleError(error, res) {
  if (error.code === "23505") {
    return res.status(409).json({ error: "El registro ya existe o duplica un dato único." });
  }
  if (error.code === "23503") {
    return res.status(400).json({ error: "La referencia seleccionada no existe." });
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "22003") {
    return res.status(400).json({ error: "Los datos no cumplen las reglas del sistema." });
  }
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Ocurrió un error interno. Intente de nuevo." });
}

function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

async function createAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Configure ADMIN_EMAIL y ADMIN_PASSWORD para crear el usuario administrador inicial.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) return;

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'ADMIN')",
    [email, hash, "Administración Orígenes"]
  );
}

export function createApp({ jwtSecret, appOrigin }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: appOrigin, methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
  app.use(express.json({ limit: "100kb" }));

  const api = express.Router();
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });
  const passwordChangeLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  api.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/auth/login", authLimit, async (req, res) => {
    try {
      const data = parseOrRespond(
        z.object({ email: z.string().email().max(255), password: z.string().min(1).max(200) }),
        req.body,
        res
      );
      if (!data) return;
      const result = await pool.query(
        "SELECT id, email, password_hash, full_name, role, session_version FROM users WHERE email = $1 AND active = TRUE",
        [data.email]
      );
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(data.password, user.password_hash))) {
        return res.status(401).json({ error: "Correo o contraseña incorrectos." });
      }
      res.json({
        token: createToken(user, jwtSecret),
        user: { id: user.id, email: user.email, name: user.full_name, role: user.role }
      });
    } catch (error) {
      handleError(error, res);
    }
  });

  api.use(authenticate(jwtSecret));

  api.get("/auth/me", async (req, res) => {
    res.json({
      id: Number(req.user.sub),
      name: req.user.name,
      role: req.user.role
    });
  });

  api.post("/auth/password", passwordChangeLimit, async (req, res) => {
    try {
      const data = parseOrRespond(
        z.object({
          currentPassword: z.string().min(1).max(200),
          newPassword: z.string().min(12, "La nueva contraseña debe tener al menos 12 caracteres.").max(200)
        }).refine((passwords) => passwords.currentPassword !== passwords.newPassword, {
          path: ["newPassword"],
          message: "La nueva contraseña debe ser diferente a la actual."
        }),
        req.body,
        res
      );
      if (!data) return;

      const result = await pool.query(
        "SELECT id, email, password_hash, full_name, role, session_version FROM users WHERE id = $1 AND active = TRUE",
        [req.user.sub]
      );
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(data.currentPassword, user.password_hash))) {
        return res.status(401).json({ error: "La contraseña actual es incorrecta." });
      }

      const passwordHash = await bcrypt.hash(data.newPassword, 12);
      const updated = await pool.query(
        `UPDATE users
         SET password_hash = $1, session_version = session_version + 1
         WHERE id = $2 AND session_version = $3 AND active = TRUE
         RETURNING id, email, full_name, role, session_version`,
        [passwordHash, user.id, user.session_version]
      );
      if (!updated.rowCount) {
        return res.status(409).json({ error: "La contraseña cambió en otra sesión. Vuelve a iniciar sesión." });
      }

      res.json({ token: createToken(updated.rows[0], jwtSecret) });
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/branches", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, code, name, address FROM branches WHERE active = TRUE ORDER BY name"
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/dashboard", async (req, res) => {
    try {
      const branchId = requireId(req.query.branchId, res, "sucursal");
      if (!branchId) return;
      const [sales, lowStock, payables, shift] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::INTEGER AS orders, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS revenue
           FROM sales WHERE branch_id = $1 AND created_at::DATE = CURRENT_DATE`,
          [branchId]
        ),
        pool.query(
          `SELECT COUNT(*)::INTEGER AS count FROM (
             SELECT i.id
             FROM ingredients i
             JOIN inventory_balances b ON b.ingredient_id = i.id AND b.branch_id = $1
             WHERE i.active = TRUE AND b.quantity <= i.minimum_stock
             UNION ALL
             SELECT p.id
             FROM products p
             JOIN inventory_balances b ON b.product_id = p.id AND b.branch_id = $1
             WHERE p.active = TRUE AND p.product_type = 'RESALE' AND b.quantity <= 5
           ) alerts`,
          [branchId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(amount - paid_amount), 0)::NUMERIC(12,2) AS outstanding
           FROM accounts_payable ap
           JOIN purchases p ON p.id = ap.purchase_id
           WHERE p.branch_id = $1 AND ap.status <> 'PAID'`,
          [branchId]
        ),
        pool.query(
          `SELECT id, opening_amount, opened_at
           FROM cash_shifts WHERE branch_id = $1 AND status = 'OPEN'`,
          [branchId]
        )
      ]);
      res.json({
        todayOrders: sales.rows[0].orders,
        todayRevenue: Number(sales.rows[0].revenue),
        lowStockCount: lowStock.rows[0].count,
        outstandingPayables: Number(payables.rows[0].outstanding),
        cashShift: shift.rows[0] || null
      });
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/products", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.sku, p.name, p.category, p.price, p.product_type AS "productType",
                COALESCE(json_agg(json_build_object(
                  'ingredientId', i.id, 'ingredient', i.name, 'unit', i.unit, 'quantity', ri.quantity
                )) FILTER (WHERE i.id IS NOT NULL), '[]'::JSON) AS recipe
         FROM products p
         LEFT JOIN recipe_items ri ON ri.product_id = p.id
         LEFT JOIN ingredients i ON i.id = ri.ingredient_id
         WHERE p.active = TRUE
         GROUP BY p.id ORDER BY p.category, p.name`
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/inventory", async (req, res) => {
    try {
      const branchId = requireId(req.query.branchId, res, "sucursal");
      if (!branchId) return;
      const result = await pool.query(
        `SELECT 'INGREDIENT' AS type, i.id, i.name, i.unit, b.quantity,
                i.minimum_stock AS "minimumStock", b.quantity <= i.minimum_stock AS "lowStock"
         FROM ingredients i
         JOIN inventory_balances b ON b.ingredient_id = i.id AND b.branch_id = $1
         WHERE i.active = TRUE
         UNION ALL
         SELECT 'RESALE' AS type, p.id, p.name, 'unidad' AS unit, b.quantity,
                5::NUMERIC AS "minimumStock", b.quantity <= 5 AS "lowStock"
         FROM products p
         JOIN inventory_balances b ON b.product_id = p.id AND b.branch_id = $1
         WHERE p.product_type = 'RESALE' AND p.active = TRUE
         ORDER BY "lowStock" DESC, name`,
        [branchId]
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/suppliers", async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name, tax_id AS \"taxId\", phone, email FROM suppliers WHERE active = TRUE ORDER BY name"
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/purchases", async (req, res) => {
    try {
      const branchId = requireId(req.query.branchId, res, "sucursal");
      if (!branchId) return;
      const result = await pool.query(
        `SELECT p.id, p.supplier_invoice AS "supplierInvoice", p.purchased_at AS "purchasedAt",
                p.due_at AS "dueAt", p.subtotal, p.tax, p.total, s.name AS supplier,
                ap.amount - ap.paid_amount AS outstanding, ap.status
         FROM purchases p
         JOIN suppliers s ON s.id = p.supplier_id
         JOIN accounts_payable ap ON ap.purchase_id = p.id
         WHERE p.branch_id = $1
         ORDER BY p.created_at DESC LIMIT 100`,
        [branchId]
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/purchases", async (req, res) => {
    const data = parseOrRespond(purchaseSchema, req.body, res);
    if (!data) return;
    try {
      const purchase = await inTransaction(async (client) => {
        let subtotal = 0;
        const lines = data.items.map((item) => {
          const lineTotal = roundMoney(item.quantity * item.unitCost);
          subtotal = roundMoney(subtotal + lineTotal);
          return { ...item, lineTotal };
        });
        const tax = roundMoney(subtotal * 0.13);
        const total = roundMoney(subtotal + tax);
        const header = await client.query(
          `INSERT INTO purchases
             (branch_id, supplier_id, supplier_invoice, purchased_at, due_at, subtotal, tax, total, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [data.branchId, data.supplierId, data.supplierInvoice, data.purchasedAt, data.dueAt,
            subtotal, tax, total, Number(req.user.sub)]
        );
        const purchaseId = header.rows[0].id;
        for (const item of lines) {
          await client.query(
            `INSERT INTO purchase_items
               (purchase_id, ingredient_id, product_id, quantity, unit_cost, line_total)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [purchaseId, item.ingredientId || null, item.productId || null, item.quantity, item.unitCost, item.lineTotal]
          );
          if (item.ingredientId) {
            await client.query(
              `INSERT INTO inventory_balances (branch_id, ingredient_id, quantity)
               VALUES ($1, $2, $3)
               ON CONFLICT (branch_id, ingredient_id) WHERE ingredient_id IS NOT NULL
               DO UPDATE SET quantity = inventory_balances.quantity + EXCLUDED.quantity, updated_at = NOW()`,
              [data.branchId, item.ingredientId, item.quantity]
            );
          } else {
            await client.query(
              `INSERT INTO inventory_balances (branch_id, product_id, quantity)
               VALUES ($1, $2, $3)
               ON CONFLICT (branch_id, product_id) WHERE product_id IS NOT NULL
               DO UPDATE SET quantity = inventory_balances.quantity + EXCLUDED.quantity, updated_at = NOW()`,
              [data.branchId, item.productId, item.quantity]
            );
          }
        }
        await client.query(
          `INSERT INTO accounts_payable (purchase_id, amount, due_at) VALUES ($1, $2, $3)`,
          [purchaseId, total, data.dueAt]
        );
        return { id: purchaseId, subtotal, tax, total };
      });
      res.status(201).json(purchase);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/cash/status", async (req, res) => {
    try {
      const branchId = requireId(req.query.branchId, res, "sucursal");
      if (!branchId) return;
      const result = await pool.query(
        `SELECT id, opening_amount AS "openingAmount", opened_at AS "openedAt"
         FROM cash_shifts WHERE branch_id = $1 AND status = 'OPEN'`,
        [branchId]
      );
      if (!result.rows[0]) return res.json({ shift: null, totals: {} });
      const totals = await pool.query(
        `SELECT payment_method AS method, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
         FROM sales WHERE cash_shift_id = $1 GROUP BY payment_method`,
        [result.rows[0].id]
      );
      res.json({ shift: result.rows[0], totals: Object.fromEntries(totals.rows.map((row) => [row.method, Number(row.total)])) });
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/cash/open", async (req, res) => {
    const data = parseOrRespond(z.object({
      branchId: idSchema,
      openingAmount: moneySchema
    }), req.body, res);
    if (!data) return;
    try {
      const result = await pool.query(
        `INSERT INTO cash_shifts (branch_id, opened_by, opening_amount)
         VALUES ($1, $2, $3) RETURNING id, opening_amount AS "openingAmount", opened_at AS "openedAt"`,
        [data.branchId, Number(req.user.sub), data.openingAmount]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/cash/close", async (req, res) => {
    const data = parseOrRespond(z.object({
      branchId: idSchema,
      countedCash: moneySchema,
      countedCard: moneySchema,
      countedBitcoin: moneySchema,
      countedChivo: moneySchema
    }), req.body, res);
    if (!data) return;
    try {
      const closed = await inTransaction(async (client) => {
        const shift = await client.query(
          `SELECT id, opening_amount FROM cash_shifts
           WHERE branch_id = $1 AND status = 'OPEN' FOR UPDATE`,
          [data.branchId]
        );
        if (!shift.rows[0]) throw fail(409, "No hay una caja abierta en esta sucursal.");
        const totals = await client.query(
          `SELECT payment_method AS method, COALESCE(SUM(total), 0)::NUMERIC(12,2) AS total
           FROM sales WHERE cash_shift_id = $1 GROUP BY payment_method`,
          [shift.rows[0].id]
        );
        const sales = Object.fromEntries(totals.rows.map((row) => [row.method, Number(row.total)]));
        const reconciliation = reconcileCash({
          openingAmount: Number(shift.rows[0].opening_amount),
          sales,
          counted: {
            CASH: data.countedCash,
            CARD: data.countedCard,
            BITCOIN: data.countedBitcoin,
            CHIVO: data.countedChivo
          }
        });
        await client.query(
          `UPDATE cash_shifts SET closed_by = $1, closed_at = NOW(), counted_cash = $2,
             counted_card = $3, counted_bitcoin = $4, counted_chivo = $5, difference = $6,
             cash_difference = $7, card_difference = $8, bitcoin_difference = $9, chivo_difference = $10,
             status = 'CLOSED'
           WHERE id = $11`,
          [Number(req.user.sub), data.countedCash, data.countedCard, data.countedBitcoin, data.countedChivo,
            reconciliation.difference, reconciliation.differences.CASH, reconciliation.differences.CARD,
            reconciliation.differences.BITCOIN, reconciliation.differences.CHIVO, shift.rows[0].id]
        );
        return { expectedCash: reconciliation.expected.CASH, ...reconciliation };
      });
      res.json(closed);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/sales", async (req, res) => {
    const data = parseOrRespond(z.object({
      branchId: idSchema,
      documentType: z.enum(["CONSUMER_FINAL", "CCF"]),
      paymentMethod: z.enum(paymentMethods),
      items: z.array(z.object({
        productId: idSchema,
        quantity: z.coerce.number().int().positive()
      })).min(1)
    }), req.body, res);
    if (!data) return;

    try {
      const sale = await inTransaction(async (client) => {
        const shift = await client.query(
          `SELECT id FROM cash_shifts
           WHERE branch_id = $1 AND status = 'OPEN' FOR UPDATE`,
          [data.branchId]
        );
        if (!shift.rows[0]) throw fail(409, "Abra la caja de la sucursal antes de registrar ventas.");

        const productIds = [...new Set(data.items.map((item) => item.productId))];
        const products = await client.query(
          `SELECT id, sku, name, price, product_type FROM products
           WHERE id = ANY($1::INTEGER[]) AND active = TRUE`,
          [productIds]
        );
        if (products.rowCount !== productIds.length) throw fail(400, "Uno o más productos no están disponibles.");
        const productById = new Map(products.rows.map((product) => [product.id, product]));
        const saleLines = data.items.map((item) => {
          const product = productById.get(item.productId);
          return {
            ...item,
            unitPrice: Number(product.price),
            productName: product.name,
            productType: product.product_type,
            lineTotal: roundMoney(Number(product.price) * item.quantity)
          };
        });
        const totals = calculateSaleTotals(saleLines);

        const recipeProducts = saleLines.filter((item) => item.productType === "RECIPE");
        const resaleProducts = saleLines.filter((item) => item.productType === "RESALE");
        if (recipeProducts.length) {
          const recipes = await client.query(
            `SELECT product_id AS "productId", ingredient_id AS "ingredientId", quantity
             FROM recipe_items WHERE product_id = ANY($1::INTEGER[])`,
            [recipeProducts.map((item) => item.productId)]
          );
          const recipeMap = new Map();
          for (const row of recipes.rows) {
            const list = recipeMap.get(row.productId) || [];
            list.push({ ingredientId: row.ingredientId, quantity: Number(row.quantity) });
            recipeMap.set(row.productId, list);
          }
          const requirements = new Map();
          for (const item of recipeProducts) {
            const recipe = recipeMap.get(item.productId);
            if (!recipe?.length) throw fail(409, `El producto "${item.productName}" no tiene receta configurada.`);
            for (const requirement of calculateRecipeRequirements(recipe, item.quantity)) {
              requirements.set(
                requirement.ingredientId,
                roundQuantity((requirements.get(requirement.ingredientId) || 0) + requirement.quantity)
              );
            }
          }
          for (const [ingredientId, quantity] of requirements) {
            const updated = await client.query(
              `UPDATE inventory_balances SET quantity = quantity - $1, updated_at = NOW()
               WHERE branch_id = $2 AND ingredient_id = $3 AND quantity >= $1
               RETURNING id`,
              [quantity, data.branchId, ingredientId]
            );
            if (!updated.rowCount) {
              const ingredient = await client.query("SELECT name FROM ingredients WHERE id = $1", [ingredientId]);
              throw fail(409, `Inventario insuficiente para ${ingredient.rows[0]?.name || "un insumo"}.`);
            }
          }
        }
        for (const item of resaleProducts) {
          const updated = await client.query(
            `UPDATE inventory_balances SET quantity = quantity - $1, updated_at = NOW()
             WHERE branch_id = $2 AND product_id = $3 AND quantity >= $1 RETURNING id`,
            [item.quantity, data.branchId, item.productId]
          );
          if (!updated.rowCount) throw fail(409, `Inventario insuficiente para ${item.productName}.`);
        }

        const header = await client.query(
          `INSERT INTO sales
             (branch_id, cash_shift_id, cashier_id, payment_method, subtotal, tax, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [data.branchId, shift.rows[0].id, Number(req.user.sub), data.paymentMethod,
            totals.subtotal, totals.tax, totals.total]
        );
        const saleId = header.rows[0].id;
        for (const item of saleLines) {
          await client.query(
            `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, line_total)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.lineTotal]
          );
        }
        const fiscalYear = new Date().getFullYear();
        const sequence = await client.query(
          `INSERT INTO invoice_counters (branch_id, document_type, fiscal_year, next_number)
           VALUES ($1, $2, $3, 2)
           ON CONFLICT (branch_id, document_type, fiscal_year)
           DO UPDATE SET next_number = invoice_counters.next_number + 1
           RETURNING next_number - 1 AS sequence_number`,
          [data.branchId, data.documentType, fiscalYear]
        );
        const branch = await client.query("SELECT code FROM branches WHERE id = $1", [data.branchId]);
        const invoiceSequence = sequence.rows[0].sequence_number;
        const prefix = data.documentType === "CCF" ? "CCF" : "FC";
        const invoiceNumber = `${prefix}-${branch.rows[0].code}-${fiscalYear}-${String(invoiceSequence).padStart(6, "0")}`;
        const invoice = await client.query(
          `INSERT INTO invoices
             (sale_id, branch_id, document_type, fiscal_year, sequence_number, invoice_number, subtotal, tax, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING invoice_number AS "invoiceNumber"`,
          [saleId, data.branchId, data.documentType, fiscalYear, invoiceSequence,
            invoiceNumber, totals.subtotal, totals.tax, totals.total]
        );
        return { id: saleId, invoice: invoice.rows[0].invoiceNumber, ...totals };
      });
      res.status(201).json(sale);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/employees", async (req, res) => {
    try {
      const branchId = requireId(req.query.branchId, res, "sucursal");
      if (!branchId) return;
      const result = await pool.query(
        `SELECT id, full_name AS "fullName", position, monthly_salary AS "monthlySalary"
         FROM employees WHERE active = TRUE AND (branch_id = $1 OR branch_id IS NULL)
         ORDER BY full_name`,
        [branchId]
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/employees", async (req, res) => {
    const data = parseOrRespond(z.object({
      branchId: idSchema,
      fullName: z.string().trim().min(2).max(160),
      position: z.string().trim().min(2).max(100),
      monthlySalary: z.coerce.number().positive().max(1_000_000)
    }), req.body, res);
    if (!data) return;
    try {
      const result = await pool.query(
        `INSERT INTO employees (branch_id, full_name, position, monthly_salary)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name AS "fullName", position, monthly_salary AS "monthlySalary"`,
        [data.branchId, data.fullName, data.position, data.monthlySalary]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.get("/payroll", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT r.id, r.period_start AS "periodStart", r.period_end AS "periodEnd",
                SUM(l.gross)::NUMERIC(12,2) AS gross,
                SUM(l.net)::NUMERIC(12,2) AS net,
                COUNT(l.id)::INTEGER AS employees
         FROM payroll_runs r JOIN payroll_lines l ON l.payroll_run_id = r.id
         GROUP BY r.id ORDER BY r.created_at DESC LIMIT 50`
      );
      res.json(result.rows);
    } catch (error) {
      handleError(error, res);
    }
  });

  api.post("/payroll", async (req, res) => {
    const data = parseOrRespond(payrollSchema, req.body, res);
    if (!data) return;
    try {
      const payroll = await inTransaction(async (client) => {
        const employees = await client.query(
          `SELECT id, full_name, monthly_salary FROM employees
           WHERE active = TRUE AND (branch_id = $1 OR branch_id IS NULL) ORDER BY id`,
          [data.branchId]
        );
        if (!employees.rowCount) throw fail(409, "Registre empleados activos antes de generar la planilla.");
        const run = await client.query(
          `INSERT INTO payroll_runs (branch_id, period_start, period_end, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [data.branchId, data.periodStart, data.periodEnd, Number(req.user.sub)]
        );
        const lines = [];
        for (const employee of employees.rows) {
          const amounts = calculatePayroll(Number(employee.monthly_salary));
          await client.query(
            `INSERT INTO payroll_lines
               (payroll_run_id, employee_id, employee_name, monthly_salary, gross, isss, afp, taxable_income, income_tax, net)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [run.rows[0].id, employee.id, employee.full_name, employee.monthly_salary,
              amounts.gross, amounts.isss, amounts.afp, amounts.taxableIncome, amounts.incomeTax, amounts.net]
          );
          lines.push({ employee: employee.full_name, ...amounts });
        }
        return { id: run.rows[0].id, periodStart: data.periodStart, periodEnd: data.periodEnd, lines };
      });
      res.status(201).json(payroll);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.use("/api", api);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Recurso API no encontrado." }));

  const webRoot = path.resolve(__dirname, "../../dist");
  app.use(express.static(webRoot, { index: false }));
  app.get("/{*path}", (_req, res, next) => {
    res.sendFile(path.join(webRoot, "index.html"), (error) => {
      if (error) next();
    });
  });

  app.use((error, _req, res, _next) => {
    handleError(error, res);
  });
  return app;
}

export { createAdminUser };

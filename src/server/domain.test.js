import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePayroll,
  calculateRecipeRequirements,
  calculateSaleTotals,
  reconcileCash
} from "./domain.js";

test("calcula IVA salvadoreño de 13% y total de venta", () => {
  assert.deepEqual(
    calculateSaleTotals([{ unitPrice: 10, quantity: 2 }]),
    { subtotal: 20, tax: 2.6, total: 22.6 }
  );
});

test("calcula salario quincenal y deducciones del empleado", () => {
  assert.deepEqual(calculatePayroll(600), {
    gross: 300,
    isss: 9,
    afp: 21.75,
    taxableIncome: 269.25,
    incomeTax: 12.16,
    net: 257.09
  });
});

test("no aplica ISR bajo el umbral quincenal exento", () => {
  assert.equal(calculatePayroll(400).incomeTax, 0);
});

test("cuadra cada medio de pago sin ocultar diferencias compensadas", () => {
  const result = reconcileCash({
    openingAmount: 50,
    sales: { CASH: 100, CARD: 40, BITCOIN: 5, CHIVO: 10 },
    counted: { CASH: 150, CARD: 30, BITCOIN: 5, CHIVO: 20 }
  });
  assert.deepEqual(result.expected, { CASH: 150, CARD: 40, BITCOIN: 5, CHIVO: 10 });
  assert.deepEqual(result.differences, { CASH: 0, CARD: -10, BITCOIN: 0, CHIVO: 10 });
  assert.equal(result.difference, 0);
});

test("rechaza cantidad inválida y escala cada ingrediente de la receta", () => {
  assert.throws(() => calculateRecipeRequirements([], 0), /entero positivo/);
  assert.deepEqual(
    calculateRecipeRequirements(
      [{ ingredientId: 4, quantity: 18 }, { ingredientId: 5, quantity: 250 }],
      3
    ),
    [{ ingredientId: 4, quantity: 54 }, { ingredientId: 5, quantity: 750 }]
  );
});

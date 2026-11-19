export const VAT_RATE = 0.13;
export const EMPLOYEE_ISSS_RATE = 0.03;
export const EMPLOYEE_AFP_RATE = 0.0725;

const QUINCENAL_ISR_BRACKETS = [
  { upper: 236, threshold: 0, fixed: 0, rate: 0 },
  { upper: 447.62, threshold: 236, fixed: 8.83, rate: 0.1 },
  { upper: 1019.05, threshold: 447.62, fixed: 30, rate: 0.2 },
  { upper: Infinity, threshold: 1019.05, fixed: 144.28, rate: 0.3 }
];

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function calculateSaleTotals(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Agregue al menos un producto a la venta.");
  }

  const subtotal = roundMoney(
    lines.reduce((total, line) => total + Number(line.unitPrice) * Number(line.quantity), 0)
  );
  const tax = roundMoney(subtotal * VAT_RATE);

  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}

export function calculatePayroll(monthlySalary) {
  const salary = Number(monthlySalary);
  if (!Number.isFinite(salary) || salary <= 0) {
    throw new Error("El salario mensual debe ser mayor que cero.");
  }

  const gross = roundMoney(salary / 2);
  const isss = roundMoney(gross * EMPLOYEE_ISSS_RATE);
  const afp = roundMoney(gross * EMPLOYEE_AFP_RATE);
  const taxableIncome = roundMoney(gross - isss - afp);
  const bracket = QUINCENAL_ISR_BRACKETS.find((item) => taxableIncome <= item.upper);
  const incomeTax = roundMoney(
    Math.max(0, (taxableIncome - bracket.threshold) * bracket.rate + bracket.fixed)
  );

  return {
    gross,
    isss,
    afp,
    taxableIncome,
    incomeTax,
    net: roundMoney(gross - isss - afp - incomeTax)
  };
}

export function reconcileCash({ openingAmount, sales, counted }) {
  const expected = {
    CASH: roundMoney(Number(openingAmount) + Number(sales.CASH || 0)),
    CARD: roundMoney(Number(sales.CARD || 0)),
    BITCOIN: roundMoney(Number(sales.BITCOIN || 0)),
    CHIVO: roundMoney(Number(sales.CHIVO || 0))
  };
  const differences = Object.fromEntries(
    Object.entries(expected).map(([method, amount]) => [
      method,
      roundMoney(Number(counted[method]) - amount)
    ])
  );
  const difference = roundMoney(
    Object.values(differences).reduce((sum, amount) => sum + amount, 0)
  );
  return { expected, differences, difference };
}

export function calculateRecipeRequirements(recipe, quantity) {
  const count = Number(quantity);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("La cantidad debe ser un entero positivo.");
  }

  return recipe.map((item) => ({
    ingredientId: item.ingredientId,
    quantity: roundQuantity(Number(item.quantity) * count)
  }));
}

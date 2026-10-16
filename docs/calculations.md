# Cómo calcula Cuenta Clara

Toda la lógica vive en funciones puras, sin base de datos ni reloj, en `backend/app/services/periods.py` y `backend/app/services/projections.py`. Sus tests están en `tests/test_periods.py` y `tests/test_projections.py`.

## El modelo en una frase

El usuario tenía **`initial_balance`** el día **`balance_as_of`**. Desde ese día:

| Entra dinero | Sale dinero |
| --- | --- |
| Ingresos recurrentes (`incomes`) | Gastos fijos (`fixed_expenses`) |
| Transacciones de tipo `income` | Transacciones de tipo `expense` (gasto variable) |

**Nada con fecha anterior a `balance_as_of` cuenta**: el monto inicial ya lo incluye.

```
saldo al cierre del periodo = saldo de apertura + ingresos − gastos fijos − gasto variable
```

### El ejemplo del enunciado

Semana del lunes 5 de octubre: monto inicial **$100**, gasto de **$30**, ingreso de **$160**.

```
100 − 30 = 70        (lo que queda tras el gasto)
70 + 160 = 230       (saldo disponible al cierre de la semana)
```

Está cubierto por `test_spec_example_100_minus_30_plus_160_is_230`, en dos variantes: con el $30 como transacción y como gasto fijo. Además, `test_dashboard_spec_example` lo verifica de punta a punta por la API.

## Cuentas y transferencias

Todo se calcula sobre un **alcance**: una cuenta (por defecto la principal) o todas (`?account=all`).

- El saldo inicial es la suma de los saldos iniciales de las cuentas del alcance, y solo cuentan sus movimientos, ingresos y gastos fijos.
- Una **transferencia** que entra o sale del alcance cambia su saldo, pero **no es ingreso ni gasto**: no suma al "Gastado", no consume el límite y no aparece en categorías.
- Si ambas cuentas están dentro del alcance (vista "Todas"), la transferencia se anula.
- El límite de gasto se aplica cuando la cuenta principal está en el alcance: sola o dentro de "Todas".

```
saldo = saldo inicial + ingresos − gastos fijos − gasto variable + transferencias que entran − transferencias que salen
```

Ejemplo: "Gastos del día" con $100 y "Ahorro" con $400. Se pasan **$50** de Gastos a Ahorro:

| Vista | Saldo | Gastado | Transferencias |
| --- | --- | --- | --- |
| Gastos del día | $50 | $0 | −$50 |
| Ahorro | $450 | $0 | +$50 |
| Todas | $500 | $0 | $0 (se anula) |

Cubierto por `test_a_transfer_moves_money_without_counting_as_spending` y `test_dashboard_opens_on_the_primary_account_and_can_switch`.

## Dinero de terceros

Un movimiento marcado `third_party` es dinero que **no es del usuario**: se lo pasaron para pagar algo de otra persona (`type=income`) o lo pagó por ella (`type=expense`). Funciona como una transferencia que viene de fuera:

- Cambia el saldo de la cuenta, pero **no es ingreso ni gasto**: no suma a "Ingresos" ni a "Gastado", no consume el límite, no tiene categoría, no entra en el presupuesto y no cambia el gasto variable que usa la predicción.
- El dashboard devuelve su neto del periodo en `third_party`; el saldo disponible lo incluye.
- **Por usar de terceros** (`GET /transactions/third-party-balance`) = lo recibido − lo pagado por ellos, desde `balance_as_of` y en todas las cuentas. Si es negativo, el usuario puso dinero propio.

```
saldo = saldo inicial + ingresos − gastos fijos − gasto variable + transferencias + dinero de terceros (recibido − pagado)
```

Ejemplo (semanal, $100, límite $40, pasaje $30): mamá le pasa **$50** para la luz y paga **$45**. Ingresos $0, Gastado $30, le quedan $10 del límite, saldo **$75** y le quedan **$5** de terceros por usar. Cubierto por `tests/test_third_party.py`.

Un **ingreso ocasional** (un regalo, lo que le mandan a veces) es un movimiento de ingreso normal: sí cuenta como ingreso, pero no se repite ni pregunta nada.

## Periodos

| Periodo | Ventana |
| --- | --- |
| Diario | el día |
| Semanal | lunes a domingo |
| Quincenal | bloques de 14 días contados desde el lunes 1-ene-2024, iguales para todos |
| Mensual | día 1 al último día del mes |
| Personalizado (N días) | bloques de N días contados desde `balance_as_of` |

El cliente envía su fecha local (`?date=YYYY-MM-DD`), así "hoy" coincide con la zona horaria del usuario y los tests son deterministas.

## Repeticiones

- Diario, semanal, quincenal y personalizado se repiten cada 1, 7, 14 o N días **desde `start_date`**.
- Mensual cae el `due_day` (gastos fijos) o el día de `start_date` (ingresos). Si el mes es más corto, se mueve a su último día: un día 31 cae el 30 de abril y el 28 de febrero.
- Solo cuentan los registros **activos**. Desactivar un ingreso o gasto fijo lo quita también de los cálculos pasados (no se guarda el historial de cuándo estuvo activo).

## Dashboard (`GET /dashboard?period=weekly&date=2026-10-07`)

- **`opening_balance`**: saldo al cierre del periodo anterior.
- **`income`**, **`fixed_expenses`**, **`variable_expenses`**, **`spent`**: movimientos del periodo actual completo, incluidos los que ya están programados para días posteriores dentro del mismo periodo.
- **`available_balance`** = `opening_balance + income − spent`. Es una identidad, y los tests la verifican.
- **Límite de gasto:** el usuario lo define por su periodo de ingreso. Si el dashboard muestra otro periodo, se convierte por duración promedio: mes = 30.4375 días. Por ejemplo, $304.38/mes ≈ $70.00/semana.
  - **El límite se compara con todo lo gastado (fijos + variables).** Es la respuesta honesta a "¿me alcanza?".
  - `over_limit` es estricto: gastar exactamente el límite no es pasarse.
- **`series`**: los últimos 6 periodos con su gasto, su límite y la bandera `over_limit`, para la gráfica de barras.
- **`upcoming_fixed_expenses`**: la próxima fecha de cada gasto fijo, las 5 más cercanas.

## Predicción (`GET /forecast?periods=4`)

El primer periodo es el **actual**, con datos reales. Los siguientes se proyectan:

```
cierre = apertura + ingresos recurrentes − gastos fijos − gasto variable promedio
```

- **Gasto variable promedio:** la media de los últimos 6 periodos **completos** desde `balance_as_of`. Los periodos parcialmente registrados no cuentan, porque bajarían el promedio artificialmente.
- **Usuario nuevo**, sin periodos completos: se usa lo gastado en el periodo actual hasta ahora.
- Las transacciones de ingreso ya registradas con fecha futura sí se suman. Los gastos variables futuros no, porque ya los representa el promedio.

## Dinero

- Siempre `Decimal` y `NUMERIC(12,2)`, nunca float.
- Redondeo a centavos `ROUND_HALF_UP`, solo al final de cada cálculo.
- En JSON los montos viajan como texto: `"230.00"`.

## Alerta, comparación y categorías (Fase 9)

- **`limit_status`:** `warning` desde el 80 % del límite usado; `over` al pasarlo, con el mismo criterio estricto de antes.
- **Periodo anterior:** los mismos totales para el periodo inmediatamente anterior, y la misma regla de `balance_as_of`: lo anterior a esa fecha cuenta como 0.
- **Por categoría:** gastos fijos (según su categoría) y variables del periodo, agrupados. Los ingresos no se incluyen.

## Metas de ahorro

```
falta            = max(meta − ahorrado, 0)
periodos_restantes = periodos desde el actual hasta el que contiene la fecha objetivo (inclusive)
por_periodo      = ⌈ falta / periodos_restantes ⌉   (al centavo)
```

Ejemplo semanal, miércoles 7 de octubre, meta $200 con $100 ahorrados para el domingo 25: quedan 3 semanas (la actual y 2 más) → $100 / 3 = **$33.34** por semana.

## Predicción con tendencia (`estimator=trend`)

1. Toma el gasto variable de hasta 8 periodos **completos** desde `balance_as_of` (x = 0, 1, …, n−1).
2. Ajusta una recta por mínimos cuadrados: `pendiente = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²`, `intercepto = ȳ − pendiente · x̄`.
3. El periodo actual es x = n. Para el periodo futuro k se estima `intercepto + pendiente · (n + k)`, nunca menos de 0.
4. **R²** (de 0 a 1) indica qué tanto explica la recta el historial; la página lo muestra.
5. Con menos de 3 periodos se usa el promedio, y la respuesta lo indica (`estimator: "average"`).

Ejemplo: gastos de 10, 20 y 30 en tres semanas → pendiente 10, R² 1. La semana actual es x = 3, así que las dos siguientes se estiman en **50** y **60**.

## Presupuesto por categoría (`GET /budgets?period=weekly&date=2026-10-07`)

Funciones puras en `backend/app/services/budgets.py`, probadas en `tests/test_budgets.py`.

- **Se guarda por el periodo de ingreso del usuario**, el mismo del límite de gasto. Si se muestra otro periodo, se convierte por duración promedio (`convert_amount`, la misma regla del límite):

  ```
  presupuesto en el periodo mostrado = monto × días(periodo mostrado) / días(periodo de ingreso)
  ```

  Se redondea a centavos solo al final. Ejemplo: $70/semana → 70 × 30.4375 / 7 = **$304.38/mes**.
- **Gastado en una categoría** = gastos fijos + gasto variable de esa categoría en la ventana del periodo. Es exactamente el desglose por categoría del dashboard (`spending_by_category`):
  - Sin ingresos ni transferencias.
  - Nada anterior a `balance_as_of`.
  - Dentro del alcance de cuenta (la principal o `?account=all`).
- **Uso y estado:**

  ```
  percent = gastado × 100 / presupuesto   (2 decimales)
  ```

  | Estado | Cuándo |
  | --- | --- |
  | `none` | la categoría no tiene presupuesto |
  | `ok` | menos del 80 % |
  | `warning` | desde el 80 % (`WARNING_PERCENT`), sin pasarse |
  | `over` | gastado **estrictamente** mayor que el presupuesto |

  Los umbrales se comparan sin redondear: 79.99 % es `ok`, 80 % y 100 % son `warning`, y 100.01 % es `over`.
- **`unbudgeted_spent`** = lo gastado en categorías sin presupuesto más «Sin categoría».
- **Totales:**
  - presupuestado = suma de los presupuestos ya convertidos;
  - gastado = lo gastado en categorías con presupuesto;
  - restante = presupuestado − gastado (negativo si se pasó).
- **Contra el límite global** (el que da `limit_for` para el periodo y el alcance):
  - `unassigned` = límite − total presupuestado.
  - `over_limit_warning` es verdadero si los presupuestos suman más que el límite.
  - Sin límite, o si la cuenta principal no está en el alcance, ambos son `null`.
- **Sugerencias** (`GET /budgets/suggestions`): para cada categoría, el promedio de lo gastado en los últimos 6 periodos **completos** desde `balance_as_of` (`complete_periods`, la misma historia que usa la predicción).
  - Sin periodos completos, se usa lo gastado en el periodo actual.
  - «Sin categoría» no se sugiere, porque no puede tener presupuesto.

Ejemplo semanal: presupuesto de Comida $40 y $35 gastados → quedan $5, 87.50 %, `warning`.

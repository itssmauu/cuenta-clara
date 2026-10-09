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

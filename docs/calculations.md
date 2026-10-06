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

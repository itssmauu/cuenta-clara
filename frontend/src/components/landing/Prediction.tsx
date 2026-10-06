// The worked example from the product spec: 100 − 30 + 160 = 230
const example = [
  { label: "Saldo inicial", value: "$100" },
  { label: "Gasto semanal", value: "−$30" },
  { label: "Ingreso semanal", value: "+$160" },
];

// Illustrative projection; heights are static classes (the CSP blocks inline styles)
const weeks = [
  { label: "Sem 1", balance: "$230", height: "h-[90px]", highlight: false },
  { label: "Sem 2", balance: "$360", height: "h-[130px]", highlight: false },
  { label: "Sem 3", balance: "$490", height: "h-[190px]", highlight: true },
  { label: "Sem 4", balance: "$410", height: "h-[150px]", highlight: false },
];

export function Prediction() {
  return (
    <section
      id="prediccion"
      aria-labelledby="prediccion-title"
      className="bg-surface rounded-panel flex scroll-mt-6 flex-wrap items-center gap-12 p-8 sm:p-14"
    >
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
        <p className="text-primary text-sm font-bold tracking-[0.08em]">PREDICCIÓN SEMANAL</p>
        <h2
          id="prediccion-title"
          className="font-display text-[32px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance sm:text-[44px]"
        >
          Si tienes $100 y gastas $30, te quedan $70.
        </h2>
        <p className="text-body text-[17px] leading-relaxed">
          Y cuando entra tu ingreso, la proyección se actualiza sola. Ves el saldo de cada semana
          antes de que llegue.
        </p>
        <dl className="flex flex-col gap-2.5 text-[15px] font-semibold">
          {example.map((row) => (
            <div key={row.label} className="border-line flex justify-between border-b pb-2.5">
              <dt>{row.label}</dt>
              <dd className="tabular-nums">{row.value}</dd>
            </div>
          ))}
          <div className="font-display flex justify-between text-xl font-extrabold">
            <dt>Saldo proyectado</dt>
            <dd className="text-primary tabular-nums">$230</dd>
          </div>
        </dl>
      </div>

      <figure className="bg-canvas rounded-card flex min-w-0 flex-[1.1_1_420px] flex-col gap-5 p-7">
        <figcaption className="flex items-center justify-between">
          <span className="font-display text-lg font-bold">Proyección por semana</span>
          <span className="text-muted text-[13px] font-semibold">Ejemplo</span>
        </figcaption>
        <ul className="flex h-[220px] items-end gap-4" aria-label="Saldo proyectado por semana">
          {weeks.map((week) => (
            <li
              key={week.label}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-muted text-xs font-bold tabular-nums">{week.balance}</span>
              <span
                aria-hidden="true"
                className={`w-full rounded-t-[14px] rounded-b-md ${week.height} ${
                  week.highlight ? "bg-accent" : "bg-primary-soft"
                }`}
              />
              <span className="text-xs font-bold">{week.label}</span>
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}

const steps = [
  {
    number: "01",
    title: "Tu monto inicial",
    text: "Indica con cuánto dinero partes hoy. Es la base de todos los cálculos.",
    card: "bg-primary-tint",
    numberClass: "text-primary",
    textClass: "text-on-tint",
    delay: "",
  },
  {
    number: "02",
    title: "Gastos fijos",
    text: "Internet, datos, pasaje y todo lo que pagas sí o sí cada periodo.",
    card: "bg-ink text-white",
    numberClass: "text-accent",
    textClass: "text-on-ink",
    delay: "delay-100",
  },
  {
    number: "03",
    title: "Ingresos y periodo",
    text: "Cuánto ingresas y cada cuánto: diario, semanal, quincenal, mensual o a tu medida.",
    card: "bg-surface",
    numberClass: "text-primary",
    textClass: "text-body",
    delay: "delay-200",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-title"
      className="flex scroll-mt-6 flex-wrap items-start gap-12"
    >
      <div data-reveal className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
        <p className="text-primary text-sm font-bold tracking-[0.08em]">CÓMO FUNCIONA</p>
        <h2
          id="como-title"
          className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[52px]"
        >
          Tu orden financiero empieza aquí.
        </h2>
        <p className="text-body text-[17px] leading-relaxed">
          Tres pasos de configuración y tienes una proyección lista. Cambia cualquier dato cuando tu
          situación cambie.
        </p>
      </div>
      <ol className="grid min-w-0 flex-[1.4_1_520px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
        {steps.map((step) => (
          <li
            key={step.number}
            data-reveal
            className={`rounded-card flex min-h-[260px] flex-col gap-3.5 p-7 ${step.card} ${step.delay}`}
          >
            <span
              aria-hidden="true"
              className={`font-display text-[40px] font-extrabold ${step.numberClass}`}
            >
              {step.number}
            </span>
            <h3 className="font-display text-xl leading-tight font-bold">{step.title}</h3>
            <p className={`text-[15px] leading-relaxed ${step.textClass}`}>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

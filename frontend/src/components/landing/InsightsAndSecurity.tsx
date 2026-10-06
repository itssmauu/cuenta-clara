import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

// Illustrative share of spending per category (static widths: the CSP blocks inline styles)
const categories = [
  { name: "Transporte", width: "w-[72%]", bar: "bg-accent" },
  { name: "Servicios", width: "w-[55%]", bar: "bg-focus" },
  { name: "Comida", width: "w-[40%]", bar: "bg-mint" },
  { name: "Ocio", width: "w-[22%]", bar: "bg-on-ink" },
];

const protections = [
  { icon: LockKeyhole, text: "Contraseñas cifradas con Argon2id" },
  { icon: KeyRound, text: "Sesiones seguras que caducan solas" },
  { icon: ShieldCheck, text: "Tus datos solo los ves tú" },
];

export function InsightsAndSecurity() {
  return (
    <div className="flex flex-wrap gap-6">
      <section
        aria-labelledby="categorias-title"
        className="bg-ink flex min-w-0 flex-[1.2_1_460px] flex-col gap-6 rounded-[32px] p-8 text-white sm:p-11"
      >
        <h2
          id="categorias-title"
          className="font-display text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] sm:text-[34px]"
        >
          Entiende en qué se va tu dinero.
        </h2>
        <ul className="flex flex-col gap-3" aria-label="Ejemplo de gasto por categoría">
          {categories.map((category) => (
            <li key={category.name} className="flex items-center gap-3.5">
              <span className="w-24 shrink-0 text-sm font-semibold">{category.name}</span>
              <span aria-hidden="true" className="bg-ink-2 h-3.5 flex-1 rounded-full">
                <span className={`block h-3.5 rounded-full ${category.width} ${category.bar}`} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="seguridad"
        aria-labelledby="seguridad-title"
        className="bg-primary-tint flex min-w-0 flex-[1_1_360px] scroll-mt-6 flex-col gap-4 rounded-[32px] p-8 sm:p-11"
      >
        <p className="text-primary text-sm font-bold tracking-[0.08em]">SEGURIDAD</p>
        <h2
          id="seguridad-title"
          className="font-display text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] sm:text-[34px]"
        >
          Tus datos, protegidos.
        </h2>
        <p className="text-on-tint leading-relaxed">
          Contraseñas cifradas, sesiones seguras y validación en cada paso. Tu información
          financiera es solo tuya.
        </p>
        <ul className="text-on-tint flex flex-col gap-2.5 text-[15px] font-semibold">
          {protections.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <Icon aria-hidden="true" className="text-primary size-5 shrink-0" />
              {text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

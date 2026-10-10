import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, PrivacyContact, type LegalSection } from "@/components/legal/LegalDocument";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Las condiciones para usar Cuenta Clara.",
};

const summary = [
  `${LEGAL.service} es una herramienta gratuita para organizar tus finanzas personales; no es un banco ni mueve dinero.`,
  `Debes ser mayor de ${LEGAL.minimumAge} años y cuidar tu contraseña.`,
  "Las cifras, predicciones y respuestas de Balbo son orientativas: no son asesoría financiera profesional.",
  "Puedes dejar de usar el servicio y eliminar tu cuenta cuando quieras.",
];

const sections: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "Quién presta el servicio",
    body: (
      <>
        <p>
          {LEGAL.service} es un servicio prestado por <strong>{LEGAL.owner}</strong>,{" "}
          {LEGAL.ownerKind}, en la {LEGAL.country}. Al crear una cuenta aceptas estos Términos y la{" "}
          <Link href="/legal/privacidad">Política de privacidad</Link>.
        </p>
        <PrivacyContact />
      </>
    ),
  },
  {
    id: "servicio",
    title: "Qué es y qué no es Cuenta Clara",
    body: (
      <>
        <p>
          {LEGAL.service} te ayuda a registrar tus ingresos, gastos, cuentas y metas de ahorro, y a
          ver cuánto te queda en tu periodo. Todo lo que muestra se calcula con los datos que tú
          escribes.
        </p>
        <ul>
          <li>No es un banco ni una entidad financiera, y no custodia ni mueve dinero.</li>
          <li>No se conecta a tus cuentas bancarias.</li>
          <li>
            Las «transferencias» entre tus cuentas solo son anotaciones dentro de la aplicación.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "requisitos",
    title: "Quién puede usarlo",
    body: (
      <p>
        Debes tener al menos {LEGAL.minimumAge} años y capacidad legal para aceptar estos Términos.
        La cuenta es personal: úsala solo para tus propias finanzas.
      </p>
    ),
  },
  {
    id: "cuenta",
    title: "Tu cuenta",
    body: (
      <ul>
        <li>Da un nombre y un correo reales y mantenlos actualizados.</li>
        <li>
          Mantén tu contraseña en secreto. Eres responsable de lo que se haga con tu cuenta si
          compartes tu contraseña.
        </li>
        <li>
          Avísanos si crees que alguien entró a tu cuenta sin permiso, y cambia tu contraseña.
        </li>
      </ul>
    ),
  },
  {
    id: "uso",
    title: "Uso aceptable",
    body: (
      <>
        <p>Al usar {LEGAL.service} te comprometes a no:</p>
        <ul>
          <li>
            Escribir números de cuenta, de tarjeta, claves bancarias o documentos de identidad.
          </li>
          <li>Intentar acceder a datos o cuentas de otras personas.</li>
          <li>
            Atacar, sobrecargar o intentar saltarte las medidas de seguridad del servicio, ni
            automatizar su uso de forma abusiva.
          </li>
          <li>
            Usar a Balbo para fines ajenos a tus finanzas personales o intentar manipularlo para que
            haga otra cosa.
          </li>
          <li>Usar el servicio para actividades ilícitas.</li>
        </ul>
      </>
    ),
  },
  {
    id: "asesoria",
    title: "Sin asesoría financiera",
    body: (
      <>
        <p>
          Los saldos proyectados, las predicciones, los avisos de límite y las respuestas de Balbo
          son <strong>estimaciones orientativas</strong> basadas en lo que registras. No son
          asesoría financiera, fiscal, legal ni de inversión, y pueden contener errores.
        </p>
        <p>
          Las decisiones sobre tu dinero son tuyas. Para decisiones importantes, consulta con un
          profesional.
        </p>
      </>
    ),
  },
  {
    id: "balbo",
    title: "Balbo, el asistente con IA",
    body: (
      <p>
        Balbo es opcional y funciona con Gemini, de Google. Para usarlo debes activarlo y aceptar
        que se envíe un resumen de tus finanzas a Google, como explica la{" "}
        <Link href="/legal/privacidad#balbo">Política de privacidad</Link>. Hay un número máximo de
        preguntas por hora, y puede no estar disponible en algunos momentos.
      </p>
    ),
  },
  {
    id: "precio",
    title: "Precio y disponibilidad",
    body: (
      <p>
        {LEGAL.service} es gratuito. Hacemos lo posible por que funcione siempre, pero puede haber
        interrupciones por mantenimiento o fallos. Podemos cambiar, mejorar o retirar funciones; si
        alguna vez dejamos de prestar el servicio, avisaremos con antelación razonable para que
        puedas descargar tus datos.
      </p>
    ),
  },
  {
    id: "propiedad",
    title: "Propiedad intelectual",
    body: (
      <p>
        El diseño, el código, la marca y los contenidos de {LEGAL.service}, incluido el personaje de
        Balbo, pertenecen a {LEGAL.owner}. Los datos que registras son tuyos: puedes descargarlos o
        eliminarlos cuando quieras.
      </p>
    ),
  },
  {
    id: "responsabilidad",
    title: "Responsabilidad",
    body: (
      <p>
        En la medida que lo permita la ley, {LEGAL.owner} no responde por decisiones que tomes
        basándote en las estimaciones de la aplicación, por errores en los datos que escribas ni por
        interrupciones del servicio ajenas a su control. Nada en estos Términos limita los derechos
        que te reconocen las leyes de protección al consumidor ni de protección de datos.
      </p>
    ),
  },
  {
    id: "baja",
    title: "Baja y suspensión",
    body: (
      <>
        <p>
          Puedes eliminar tu cuenta cuando quieras desde Configuración › Privacidad y datos. Se
          borrará todo de forma inmediata y definitiva.
        </p>
        <p>
          Podemos suspender o cerrar una cuenta que incumpla gravemente estos Términos o ponga en
          riesgo la seguridad del servicio o de otras personas.
        </p>
      </>
    ),
  },
  {
    id: "cambios",
    title: "Cambios en los Términos",
    body: (
      <p>
        Si cambiamos estos Términos, actualizaremos la fecha y la versión de arriba. Si el cambio es
        importante, te pediremos que lo aceptes antes de seguir usando la aplicación. Si no estás de
        acuerdo, puedes eliminar tu cuenta.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable",
    body: (
      <p>
        Estos Términos se rigen por las leyes de la {LEGAL.country}. Cualquier controversia se
        intentará resolver primero de forma amistosa y, si no es posible, ante los tribunales
        competentes de Panamá.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Términos y condiciones"
      current="/legal/terminos"
      summary={summary}
      sections={sections}
    />
  );
}

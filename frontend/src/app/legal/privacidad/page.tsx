import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, PrivacyContact, type LegalSection } from "@/components/legal/LegalDocument";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos trata Cuenta Clara, para qué, con quién se comparten y cómo ejercer tus derechos.",
};

const summary = [
  `El responsable de tus datos es ${LEGAL.owner} (${LEGAL.ownerKind}), en la ${LEGAL.country}.`,
  "Solo pedimos lo necesario: nombre, correo, contraseña y las cifras que tú decides registrar. Nunca números de cuenta ni de tarjeta.",
  "Tus datos se usan para prestarte el servicio. No los vendemos, no hacemos publicidad y no usamos cookies de seguimiento.",
  "Balbo, el asistente con IA, es opcional: solo envía un resumen de tus finanzas a Google si tú lo activas.",
  "Puedes descargar todos tus datos o eliminar tu cuenta tú mismo, cuando quieras, desde Configuración.",
];

const sections: LegalSection[] = [
  {
    id: "responsable",
    title: "Quién es el responsable",
    body: (
      <>
        <p>
          El responsable del tratamiento de tus datos personales en {LEGAL.service} es{" "}
          <strong>{LEGAL.owner}</strong>, {LEGAL.ownerKind}, con domicilio en la {LEGAL.country}. Es
          quien decide para qué y cómo se tratan tus datos y quien responde por ello.
        </p>
        <PrivacyContact />
      </>
    ),
  },
  {
    id: "normativa",
    title: "Normativa aplicable",
    body: (
      <>
        <p>Tratamos tus datos conforme a:</p>
        <ul>
          <li>La {LEGAL.law}.</li>
          <li>El {LEGAL.regulation}, que la reglamenta.</li>
        </ul>
        <p>
          La autoridad de control es la {LEGAL.authority}, ante la que puedes presentar una queja si
          consideras que no hemos respetado tus derechos.
        </p>
      </>
    ),
  },
  {
    id: "datos",
    title: "Qué datos tratamos",
    body: (
      <>
        <h3>Datos que nos das</h3>
        <ul>
          <li>
            <strong>Identificación y acceso:</strong> tu nombre, tu correo electrónico y tu
            contraseña. La contraseña nunca se guarda tal cual: solo guardamos un hash con Argon2,
            del que no se puede recuperar.
          </li>
          <li>
            <strong>Datos financieros que registras:</strong> el nombre y el tipo de tus cuentas
            (por ejemplo «Gastos» o «Ahorro»), saldos, ingresos, gastos fijos y variables,
            categorías, transferencias entre tus cuentas, metas de ahorro, tu límite de gasto y tu
            periodo de cobro.
          </li>
          <li>
            <strong>Mensajes a Balbo:</strong> las preguntas que escribes al asistente, solo si lo
            activas. No guardamos el historial de la conversación: vive en tu navegador y se borra
            al cerrar o recargar la página.
          </li>
        </ul>
        <h3>Datos que se generan al usar el servicio</h3>
        <ul>
          <li>
            <strong>Sesiones:</strong> por cada inicio de sesión guardamos un identificador cifrado,
            su fecha de caducidad y el navegador que usaste (su «user agent»), para que puedas
            mantener la sesión abierta y detectar usos extraños.
          </li>
          <li>
            <strong>Seguridad:</strong> el número de intentos fallidos de inicio de sesión y, si
            corresponde, hasta cuándo está bloqueada la cuenta. Para limitar abusos, tu dirección IP
            se usa en memoria durante unos minutos y no se guarda en la base de datos.
          </li>
          <li>
            <strong>Consentimientos:</strong> qué versión de estos documentos aceptaste y cuándo, y
            si activaste a Balbo y cuándo.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "no-pedimos",
    title: "Qué datos no pedimos",
    body: (
      <>
        <p>
          {LEGAL.service} no se conecta a tu banco. Nunca te pediremos, ni debes escribir en la
          aplicación:
        </p>
        <ul>
          <li>Números de cuenta bancaria, de tarjeta, CVV o PIN.</li>
          <li>Contraseñas o claves de tu banca en línea.</li>
          <li>Tu cédula, pasaporte u otros documentos de identidad.</li>
        </ul>
        <p>
          Por eso, la aplicación rechaza nombres de cuenta que parezcan un número de cuenta. Si
          alguien te pide estos datos en nombre de {LEGAL.service}, no se los des.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para qué los usamos",
    body: (
      <ul>
        <li>Crear y proteger tu cuenta, y permitirte iniciar sesión.</li>
        <li>
          Calcular tu panel: saldo, gasto del periodo, límite, predicciones y avance de tus metas.
        </li>
        <li>Generar los reportes CSV o PDF que descargues.</li>
        <li>Responder tus preguntas con Balbo, solo si lo activas.</li>
        <li>Detectar y prevenir accesos indebidos y abusos del servicio.</li>
      </ul>
    ),
  },
  {
    id: "base-legal",
    title: "Base legal",
    body: (
      <>
        <p>
          Tratamos tus datos con tu <strong>consentimiento</strong>, que das al crear la cuenta
          marcando la casilla de aceptación. Es libre, previo, informado e inequívoco: la casilla
          nunca viene marcada y guardamos la versión y la fecha de lo que aceptaste.
        </p>
        <p>
          El uso de Balbo tiene un consentimiento aparte y adicional. Puedes retirar cualquiera de
          los dos cuando quieras: desactivando a Balbo o eliminando tu cuenta. Retirarlo no afecta a
          lo que se hizo antes con tu permiso.
        </p>
      </>
    ),
  },
  {
    id: "balbo",
    title: "Balbo y la inteligencia artificial",
    body: (
      <>
        <p>
          Balbo es un asistente opcional que responde preguntas sobre tus finanzas. Funciona con
          Gemini, un modelo de inteligencia artificial de Google LLC. Mientras no lo actives, no se
          envía nada.
        </p>
        <p>Cuando le haces una pregunta, se envía a Google:</p>
        <ul>
          <li>Tu pregunta.</li>
          <li>
            Un resumen de tus finanzas: tu primer nombre, tus cuentas por nombre y saldo, tus
            ingresos y gastos fijos, el gasto del periodo por categoría, tu límite y tus metas.
          </li>
        </ul>
        <p>
          No se envían tu correo, tu contraseña ni tu apellido. Pedimos a Google no guardar la
          conversación. Aun así, según los términos de la API de Gemini, cuando se usa el plan
          gratuito Google puede usar el contenido para mejorar sus productos y personas revisoras
          pueden leerlo. Por eso: no escribas en el chat datos que no quieras compartir.
        </p>
        <p>
          Balbo puede equivocarse. Sus respuestas son orientativas, no son asesoría financiera
          profesional, y las decisiones sobre tu dinero son tuyas.
        </p>
      </>
    ),
  },
  {
    id: "destinatarios",
    title: "Con quién se comparten",
    body: (
      <>
        <p>
          No vendemos ni alquilamos tus datos, ni los cedemos con fines publicitarios. Solo pueden
          acceder a ellos:
        </p>
        <ul>
          <li>
            <strong>Proveedores que nos ayudan a prestar el servicio</strong> (encargados del
            tratamiento), como el alojamiento del servidor y la base de datos, que solo pueden
            usarlos para eso.
          </li>
          <li>
            <strong>Google LLC</strong>, como proveedor de Gemini, solo si activas a Balbo y en los
            términos del punto anterior.
          </li>
          <li>
            <strong>Autoridades</strong>, cuando una ley o una orden judicial nos obligue.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "transferencias",
    title: "Transferencias internacionales",
    body: (
      <p>
        Si activas a Balbo, tu pregunta y el resumen de tus finanzas se procesan en servidores de
        Google, que pueden estar fuera de Panamá (por ejemplo, en Estados Unidos). Los proveedores
        de alojamiento también pueden estar fuera del país. Al activar Balbo das tu consentimiento
        expreso a esa transferencia, y solo trabajamos con proveedores que ofrecen garantías de
        seguridad adecuadas.
      </p>
    ),
  },
  {
    id: "conservacion",
    title: "Cuánto tiempo los guardamos",
    body: (
      <ul>
        <li>
          <strong>Tu cuenta y tus datos financieros:</strong> mientras tengas la cuenta. Al
          eliminarla, se borran de forma inmediata y definitiva de la base de datos.
        </li>
        <li>
          <strong>Sesiones:</strong> caducan a los 7 días o cuando cierras sesión.
        </li>
        <li>
          <strong>Conversaciones con Balbo:</strong> no las guardamos; desaparecen al cerrar o
          recargar la página.
        </li>
        <li>
          <strong>Copias de seguridad y registros técnicos:</strong> si existen, se sobrescriben en
          ciclos cortos y solo se usan para recuperar el servicio ante un fallo.
        </li>
      </ul>
    ),
  },
  {
    id: "seguridad",
    title: "Cómo protegemos tus datos",
    body: (
      <ul>
        <li>Conexión cifrada (HTTPS) y cookies de sesión protegidas, inaccesibles para scripts.</li>
        <li>Contraseñas guardadas con Argon2, nunca en texto plano.</li>
        <li>Bloqueo temporal de la cuenta y límites de intentos ante ataques de fuerza bruta.</li>
        <li>
          Protección contra falsificación de peticiones (CSRF) y política de seguridad de contenido.
        </li>
        <li>Cada persona solo puede ver y modificar sus propios datos.</li>
      </ul>
    ),
  },
  {
    id: "derechos",
    title: "Tus derechos",
    body: (
      <>
        <p>La ley te reconoce los derechos de:</p>
        <ul>
          <li>
            <strong>Acceso:</strong> saber qué datos tuyos tratamos.
          </li>
          <li>
            <strong>Rectificación:</strong> corregir los que sean inexactos o estén incompletos.
          </li>
          <li>
            <strong>Cancelación:</strong> pedir que se eliminen.
          </li>
          <li>
            <strong>Oposición:</strong> oponerte a un tratamiento concreto.
          </li>
          <li>
            <strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso
            común.
          </li>
        </ul>
        <p>Puedes ejercerlos tú mismo, al instante y sin costo, desde la aplicación:</p>
        <ul>
          <li>
            <strong>Acceso y portabilidad:</strong> Configuración › Privacidad y datos › «Descargar
            mis datos» (archivo JSON con todo lo que guardamos de ti).
          </li>
          <li>
            <strong>Rectificación:</strong> edita tus cuentas, movimientos, metas o configuración.
          </li>
          <li>
            <strong>Cancelación:</strong> Configuración › Privacidad y datos › «Eliminar mi cuenta».
          </li>
          <li>
            <strong>Oposición al uso de IA:</strong> desactiva a Balbo en cualquier momento.
          </li>
        </ul>
        {LEGAL.contactEmail ? (
          <p>
            También puedes escribirnos a{" "}
            <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Responderemos en un
            plazo máximo de 10 días hábiles. Para proteger tu cuenta, te pediremos confirmar que
            eres el titular.
          </p>
        ) : null}
        <p>
          Si no estás de acuerdo con nuestra respuesta, puedes presentar una queja ante la{" "}
          {LEGAL.authority}.
        </p>
      </>
    ),
  },
  {
    id: "menores",
    title: "Menores de edad",
    body: (
      <p>
        {LEGAL.service} está dirigido a personas mayores de {LEGAL.minimumAge} años. No creamos
        cuentas a sabiendas para menores. Si sabes que un menor creó una cuenta, se puede eliminar
        desde la propia cuenta o avisándonos.
      </p>
    ),
  },
  {
    id: "incidentes",
    title: "Incidentes de seguridad",
    body: (
      <p>
        Si ocurriera una brecha de seguridad que afecte a tus datos, la notificaremos a la{" "}
        {LEGAL.authority} y a las personas afectadas en los plazos que marca la normativa,
        explicando qué pasó, qué datos se vieron afectados y qué medidas tomamos.
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios en esta política",
    body: (
      <>
        <p>
          Si cambiamos esta política, actualizaremos la fecha y la versión de arriba. Si el cambio
          es importante, te pediremos que lo aceptes de nuevo la próxima vez que entres, antes de
          seguir usando la aplicación.
        </p>
        <p>
          Consulta también los <Link href="/legal/terminos">Términos y condiciones</Link> y la{" "}
          <Link href="/legal/cookies">Política de cookies</Link>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de privacidad"
      current="/legal/privacidad"
      summary={summary}
      sections={sections}
    />
  );
}

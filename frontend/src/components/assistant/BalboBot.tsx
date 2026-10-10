/**
 * Balbo's robot: a little astronaut-style bot drawn in SVG, so it stays sharp at any
 * size and needs no image file. What it does depends on the chat:
 *
 * - greeting  · chat just opened, nothing asked yet: waves hello
 * - attentive · there is a conversation: eyes open, head tilted, nodding, antenna glowing
 * - typing    · a reply is on its way: pulls out a phone and types on it
 *
 * It always floats, blinks and keeps its little jet lit. All looping motion lives in
 * globals.css (`.bb…`) and stops with prefers-reduced-motion, leaving a still pose.
 */
export type BalboState = "greeting" | "attentive" | "typing";

const INK = "#14163a";
const VISOR = "#1b1f4a";
const GLOW = "#4fe3e0";
const LIMB = "#5b7cfa";
const GOLD = "#ffc94d";
const FLAME = "#4fb3ff";

export function BalboBot({
  state,
  size,
  label,
}: {
  state: BalboState;
  /** Width in px (the robot is a little taller than wide) */
  size: number;
  /** Accessible name; without it the robot is decorative */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      data-state={state}
      className="bb shrink-0 overflow-visible"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <ellipse className="bb-shadow" cx="60" cy="144" rx="22" ry="4" fill={INK} opacity="0.12" />

      <g className="bb-float">
        {/* Jet */}
        <g className="bb-flame">
          <path d="M51 123 Q60 148 69 123 Z" fill={FLAME} />
          <path d="M55.5 123 Q60 137 64.5 123 Z" fill="#c9f2ff" />
        </g>

        {/* Arms behind the body: the left one always, the right one depends on the state */}
        <g className="bb-arm-left">
          <rect
            x="25"
            y="93"
            width="11"
            height="26"
            rx="5.5"
            fill="#fff"
            stroke={INK}
            strokeWidth="2.5"
            transform="rotate(16 31 95)"
          />
          <circle cx="26" cy="121" r="5.5" fill={LIMB} stroke={INK} strokeWidth="2" />
        </g>
        <g className="bb-arm bb-arm-rest">
          <rect
            x="84"
            y="93"
            width="11"
            height="26"
            rx="5.5"
            fill="#fff"
            stroke={INK}
            strokeWidth="2.5"
            transform="rotate(-16 89 95)"
          />
          <circle cx="94" cy="121" r="5.5" fill={LIMB} stroke={INK} strokeWidth="2" />
        </g>

        {/* Body */}
        <rect
          x="39"
          y="85"
          width="42"
          height="39"
          rx="15"
          fill="#fff"
          stroke={INK}
          strokeWidth="2.5"
        />
        <ellipse cx="60" cy="123" rx="11" ry="3.5" fill={LIMB} stroke={INK} strokeWidth="2" />
        <text
          x="60"
          y="108"
          textAnchor="middle"
          fontSize="9"
          fontWeight="800"
          letterSpacing="0.4"
          fill={INK}
          fontFamily="var(--font-display), sans-serif"
        >
          BALBO
        </text>
        <circle cx="40" cy="94" r="5" fill={GOLD} stroke={INK} strokeWidth="2" />
        <circle cx="80" cy="94" r="5" fill={GOLD} stroke={INK} strokeWidth="2" />

        {/* Typing: the right arm comes forward holding a phone */}
        <g className="bb-arm bb-arm-phone">
          <rect
            x="71"
            y="91"
            width="11"
            height="22"
            rx="5.5"
            fill="#fff"
            stroke={INK}
            strokeWidth="2.5"
            transform="rotate(38 80 94)"
          />
          <g className="bb-phone">
            <rect x="55" y="99" width="17" height="26" rx="3.5" fill={INK} />
            <rect x="57.5" y="102.5" width="12" height="18" rx="1.8" fill={GLOW} />
            <circle className="bb-phone-dot" cx="60.5" cy="111.5" r="1.4" fill={INK} />
            <circle className="bb-phone-dot" cx="63.5" cy="111.5" r="1.4" fill={INK} />
            <circle className="bb-phone-dot" cx="66.5" cy="111.5" r="1.4" fill={INK} />
          </g>
          <circle
            className="bb-thumb"
            cx="71"
            cy="113"
            r="5.5"
            fill={LIMB}
            stroke={INK}
            strokeWidth="2"
          />
        </g>

        {/* Head */}
        <g className="bb-head">
          <line
            x1="60"
            y1="23"
            x2="60"
            y2="12"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            className="bb-antenna"
            cx="60"
            cy="9"
            r="4.5"
            fill={FLAME}
            stroke={INK}
            strokeWidth="2"
          />
          <rect
            x="19"
            y="42"
            width="10"
            height="23"
            rx="5"
            fill={GOLD}
            stroke={INK}
            strokeWidth="2"
          />
          <rect
            x="91"
            y="42"
            width="10"
            height="23"
            rx="5"
            fill={GOLD}
            stroke={INK}
            strokeWidth="2"
          />
          <rect
            x="26"
            y="21"
            width="68"
            height="64"
            rx="29"
            fill="#fff"
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect x="33" y="31" width="54" height="43" rx="18" fill={VISOR} />
          <path
            d="M39 40 q6 -6 15 -6"
            stroke="#fff"
            strokeOpacity="0.3"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          <g className="bb-eyes">
            {/* Happy closed-arc eyes while greeting; round open eyes otherwise */}
            <g
              className="bb-eyes-happy"
              stroke={GLOW}
              strokeWidth="3.6"
              strokeLinecap="round"
              fill="none"
            >
              <path d="M41 53 q6 -8 12 0" />
              <path d="M67 53 q6 -8 12 0" />
            </g>
            <g className="bb-eyes-open" fill={GLOW}>
              <ellipse cx="47" cy="50" rx="4" ry="5" />
              <ellipse cx="73" cy="50" rx="4" ry="5" />
            </g>
          </g>
          <path
            className="bb-mouth"
            d="M51 62 q9 8 18 0"
            stroke={GLOW}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Headset microphone */}
          <path
            d="M96 62 q-1 13 -19 11"
            stroke={INK}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="76" cy="73" r="2.6" fill={INK} />
        </g>
        {/* Waving arm last: raised beside the helmet, it must be drawn in front of it */}
        <g className="bb-arm bb-arm-wave">
          <rect
            x="81"
            y="66"
            width="11"
            height="29"
            rx="5.5"
            fill="#fff"
            stroke={INK}
            strokeWidth="2.5"
            transform="rotate(42 86 94)"
          />
          {/* Open hand with fingers, waving */}
          <g transform="rotate(42 86 94)">
            <circle cx="86.5" cy="63" r="6.5" fill={LIMB} stroke={INK} strokeWidth="2" />
            <path
              d="M82 58 v-5 M86.5 57 v-6 M91 58 v-5"
              stroke={INK}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Marca: cumbre con banderín, trazada como un icono de mapa. */
export default function BrandMark() {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <rect x="0.75" y="0.75" width="32.5" height="32.5" rx="5" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <path d="M4 27 L13 13 L17.5 19 L21 14.5 L30 27 Z" fill="currentColor" />
      <path d="M21 14.5 V5.5" stroke="#FF7440" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21.2 5.8 L27 7.6 L21.2 9.6 Z" fill="#FF7440" />
    </svg>
  );
}

export function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 21V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 4.5h11l-2.6 3.8 2.6 3.7h-11z" fill="#FF7440" />
    </svg>
  );
}

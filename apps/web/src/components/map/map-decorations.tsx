import type { FloorTexture, MapIconKind } from '@codexveil/domain';

export const floorPatternId = (uid: string, texture: FloorTexture) => `piso-${texture}-${uid}`;

export function FloorPatterns({ uid }: { uid: string }) {
  return (
    <>
      <pattern id={floorPatternId(uid, 'stone')} width="1" height="1" patternUnits="userSpaceOnUse">
        <rect width="1" height="1" fill="#68645d" />
        <path d="M0 .5h1M.5 0v.5M.25 .5V1M.75 .5V1" stroke="#8b867d" strokeWidth=".04" />
      </pattern>
      <pattern id={floorPatternId(uid, 'dirt')} width="1" height="1" patternUnits="userSpaceOnUse">
        <rect width="1" height="1" fill="#765435" />
        <circle cx=".2" cy=".28" r=".06" fill="#9b7650" />
        <circle cx=".72" cy=".68" r=".08" fill="#5c3f29" />
      </pattern>
      <pattern id={floorPatternId(uid, 'wood')} width="1" height="1" patternUnits="userSpaceOnUse">
        <rect width="1" height="1" fill="#80542e" />
        <path
          d="M0 .25h1M0 .75h1M.35 0v.25M.7 .25v.5M.25 .75V1"
          stroke="#b47a45"
          strokeWidth=".04"
        />
      </pattern>
      <pattern id={floorPatternId(uid, 'grass')} width="1" height="1" patternUnits="userSpaceOnUse">
        <rect width="1" height="1" fill="#496c36" />
        <path
          d="M.2 .8l.05-.25.08.2M.7 .45l.05-.25.08.2M.45 .25l.04-.15"
          stroke="#7e9d55"
          strokeWidth=".04"
          fill="none"
        />
      </pattern>
      <pattern id={floorPatternId(uid, 'water')} width="1" height="1" patternUnits="userSpaceOnUse">
        <rect width="1" height="1" fill="#356b82" />
        <path
          d="M-.1 .3q.25-.18.5 0t.5 0M.1 .72q.25-.18.5 0t.5 0"
          stroke="#69a9bd"
          strokeWidth=".05"
          fill="none"
        />
      </pattern>
    </>
  );
}

/** Glifos vetoriais próprios; todos cabem no quadrado 0..1. */
export function MapIconShape({ icon, color }: { icon: MapIconKind; color: string }) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 0.09,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (icon === 'chest')
    return (
      <>
        <rect x=".14" y=".34" width=".72" height=".48" rx=".08" {...common} />
        <path d="M.16 .5h.68M.5 .5v.17" {...common} />
      </>
    );
  if (icon === 'door')
    return (
      <>
        <path d="M.2 .86V.15h.6v.71M.28 .86V.25h.44v.61" {...common} />
        <circle cx=".62" cy=".56" r=".035" fill={color} />
      </>
    );
  if (icon === 'secret-door')
    return (
      <>
        <path d="M.14 .78h.72M.22 .78V.22h.56v.56" {...common} strokeDasharray=".12 .08" />
        <text x=".5" y=".62" textAnchor="middle" fontSize=".5" fontWeight="700" fill={color}>
          ?
        </text>
      </>
    );
  if (icon === 'trap')
    return (
      <>
        <path d="M.5 .12l.4 .72H.1zM.5 .38v.22" {...common} />
        <circle cx=".5" cy=".71" r=".035" fill={color} />
      </>
    );
  if (icon === 'stairs') return <path d="M.12 .82h.2V.65h.2V.48h.2V.31h.2" {...common} />;
  if (icon === 'campfire')
    return (
      <>
        <path
          d="M.25 .82l.5-.18M.25 .64l.5 .18M.5 .66c-.22-.18-.18-.38.02-.58.02.18.2.24.2.43 0 .13-.09.25-.22.15z"
          {...common}
        />
      </>
    );
  if (icon === 'altar')
    return (
      <>
        <path d="M.18 .78h.64M.28 .72l.08-.4h.28l.08.4M.24 .28h.52v.12H.24z" {...common} />
        <path d="M.5 .14v.22M.42 .22h.16" {...common} />
      </>
    );
  return (
    <>
      <path
        d="M.2 .42a.3.3 0 1 1 .6 0c0 .17-.1.26-.18.34v.12H.38V.76C.3 .68.2 .59.2 .42z"
        {...common}
      />
      <circle cx=".39" cy=".42" r=".055" fill={color} />
      <circle cx=".61" cy=".42" r=".055" fill={color} />
      <path d="M.44 .61h.12" {...common} />
    </>
  );
}

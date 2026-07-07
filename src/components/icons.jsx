function base(props) {
  return { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, ...props }
}

export function IconBell(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  )
}

export function IconSun(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconSparkles(props) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z"
        strokeLinejoin="round"
      />
      <path d="M18 15l.7 1.8L20.5 17.5 18.7 18.2 18 20l-.7-1.8L15.5 17.5 17.3 16.8Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconDroplet(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconHealthCross(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  )
}

export function IconAlert(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 4 21 19H3Z" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.5v.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconArrowRight(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconHome(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconCalendar(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  )
}

export function IconMap(props) {
  return (
    <svg {...base(props)}>
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}

export function IconNews(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M8 9h8M8 12.5h8M8 16h5" strokeLinecap="round" />
    </svg>
  )
}

export function IconBus(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="12" rx="2" />
      <path d="M4 13h16M8 17.5v2M16 17.5v2" strokeLinecap="round" />
      <circle cx="8" cy="15" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconFlag(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 4v16" strokeLinecap="round" />
      <path d="M6 5h11l-3 3.5L17 12H6" strokeLinejoin="round" />
    </svg>
  )
}

export function IconBasket(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 9h16l-1.5 9.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5Z" strokeLinejoin="round" />
      <path d="M8 9 10 4M16 9 14 4M9 13v4M15 13v4" strokeLinecap="round" />
    </svg>
  )
}

export function IconFilm(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M9 5v14M15 5v14M4 10h5M15 10h5M4 15h5M15 15h5" />
    </svg>
  )
}

export function IconBuilding(props) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="4" width="14" height="16" rx="1" />
      <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h6" strokeLinecap="round" />
    </svg>
  )
}

export function IconPaw(props) {
  return (
    <svg {...base(props)} strokeWidth="1.6">
      <circle cx="12" cy="15" r="3.4" />
      <circle cx="6.5" cy="9.5" r="1.6" />
      <circle cx="11" cy="7" r="1.6" />
      <circle cx="17.5" cy="9.5" r="1.6" />
    </svg>
  )
}

export function IconChat(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4Z" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTool(props) {
  return (
    <svg {...base(props)}>
      <path
        d="m14.5 6.5 3 3-6.8 6.8a2 2 0 0 1-1.2.6l-2.3.3.3-2.3a2 2 0 0 1 .6-1.2Z"
        strokeLinejoin="round"
      />
      <path d="M13 8 16 11" />
    </svg>
  )
}

export function IconShop(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 9 5 4h14l1 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M5 9v11h14V9" />
    </svg>
  )
}

export function IconCoffee(props) {
  return (
    <svg {...base(props)}>
      <path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path d="M16 9.5h1.5a2 2 0 0 1 0 4H16" />
      <path d="M6 5.5c.5 1 1.5 1 2 0M10 5.5c.5 1 1.5 1 2 0" strokeLinecap="round" />
    </svg>
  )
}

export function IconStethoscope(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 4v5a4 4 0 0 0 8 0V4" strokeLinecap="round" />
      <path d="M10 13v2a5 5 0 0 0 10 0v-1.5" strokeLinecap="round" />
      <circle cx="20" cy="12" r="1.3" />
    </svg>
  )
}

export function IconScissors(props) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="6" cy="17" r="2.2" />
      <path d="M8 8.5 20 17M8 15.5 20 7" strokeLinecap="round" />
    </svg>
  )
}

export function IconStore(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 9 5.5 4.5h13L20 9" strokeLinejoin="round" />
      <path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M5 9.5V20h14V9.5M10 20v-5h4v5" strokeLinejoin="round" />
    </svg>
  )
}

export function IconSearch(props) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconClose(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
    </svg>
  )
}

export function IconPin(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  )
}

export function IconPhone(props) {
  return (
    <svg {...base(props)}>
      <path
        d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5V21a1 1 0 0 1-1 1A16 16 0 0 1 5 6a1 1 0 0 1 1-2Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconGlobe(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16" />
    </svg>
  )
}

export function IconClock(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconPlus(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

export function IconRoute(props) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 18h6a3 3 0 0 0 3-3V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IconMusic(props) {
  return (
    <svg {...base(props)}>
      <path d="M9 18V6l10-2v12" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  )
}

export function IconRun(props) {
  return (
    <svg {...base(props)}>
      <circle cx="14" cy="5" r="1.8" />
      <path
        d="M13 8 9 11l3 2 1 5M12 13l-3 1-2 3M13 10l4 1 2-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconBalloon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 4a5 5 0 0 1 5 5c0 3.5-3 6-5 6s-5-2.5-5-6a5 5 0 0 1 5-5Z" strokeLinejoin="round" />
      <path d="M12 15v3M11 20h2" strokeLinecap="round" />
    </svg>
  )
}

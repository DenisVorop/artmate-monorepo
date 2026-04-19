export const heroImages = {
  workspace: {
    src: "https://images.unsplash.com/photo-1731624637604-eba223ee268d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY3JlYXRpdmUlMjB3b3Jrc3BhY2UlMjBtYXJrZXJzJTIwc2tldGNoYm9va3xlbnwxfHx8fDE3NzM0NzgxNDl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "Рабочее место художника",
  },
  hands: {
    src: "https://images.unsplash.com/photo-1666710988451-ba4450498967?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXRlcmNvbG9yJTIwcGFpbnRpbmclMjBoYW5kcyUyMGNsb3NlJTIwdXAlMjBhcnR8ZW58MXx8fHwxNzczNDc4MTQ5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "Акварельная живопись",
  },
  mandala: {
    src: "https://images.unsplash.com/photo-1740083652789-310edc4b4d02?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbGx1c3RyYXRpb24lMjBtYW5kYWxhJTIwY29sb3JpbmclMjBwYWdlJTIwb3JuYW1lbnR8ZW58MXx8fHwxNzczNDc4MTUyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "Мандала",
  },
} as const;

export const reviewAvatars = [heroImages.hands, heroImages.workspace, heroImages.mandala] as const;

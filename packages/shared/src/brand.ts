export const fanPassBrand = {
  colors: {
    inkPass: "#0B0D10",
    signalBlue: "#0054FF",
    verifyMint: "#00B08C",
    cloud: "#F4F5F6",
    card: "#FFFFFF",
    slate: "#3C414B",
    muted: "#818996",
    line: "#D8DDE4",
    amberCap: "#E99211",
    coralRisk: "#EC493C"
  },
  radius: {
    card: 8,
    control: 8,
    pill: 999
  },
  typography: {
    ios: "SF Pro",
    web: "Inter"
  }
} as const;

export type FanPassBrand = typeof fanPassBrand;

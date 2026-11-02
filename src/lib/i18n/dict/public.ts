// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// Pokriva javno navigacijo (navbar, mobilni meni).

export const publicSl = {
  navServices: "Storitve",
  navAbout: "O nas",
  navTeam: "Ekipa",
  navShop: "Trgovina",
  navContact: "Kontakt",
  account: "Račun",
  dashboard: "Nadzorna plošča",
  staffPortal: "Portal za osebje",
  myAccount: "Moj račun",
  myAppointments: "Moji termini",
  myOrders: "Moja naročila",
  myReviews: "Moje ocene",
  logout: "Odjava",
  login: "Prijava",
  toggleMenu: "Preklopi meni",
}

export type PublicDict = typeof publicSl

export const publicEn: PublicDict = {
  navServices: "Services",
  navAbout: "About us",
  navTeam: "Team",
  navShop: "Shop",
  navContact: "Contact",
  account: "Account",
  dashboard: "Dashboard",
  staffPortal: "Staff portal",
  myAccount: "My account",
  myAppointments: "My appointments",
  myOrders: "My orders",
  myReviews: "My reviews",
  logout: "Sign out",
  login: "Sign in",
  toggleMenu: "Toggle menu",
}

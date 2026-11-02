export const dashboardSl = {
  title: "Nadzorna",
  titleAccent: "plošča",
  welcome: "Dobrodošli nazaj! Tukaj je pregled vašega podjetja.",
  revenueThisMonth: "Prihodki (ta mesec)",
  appointments: "Termini",
  totalCustomers: "Število strank",
  shopSales: "Prodaja v trgovini",
  fromLastMonth: "v primerjavi s prejšnjim mesecem",
  noPreviousData: "Ni prejšnjih podatkov",
  thisMonth: "ta mesec",
  newThisWeek: "novih ta teden",
  todaysAppointments: "Današnji termini",
  /**
   * Slovenian pluralisation:
   * 0 → "Danes nimate terminov"
   * 1 → "Danes imate 1 termin"
   * 2 → "Danes imate 2 termina"
   * 3–4 → "Danes imate X termine"
   * 5+ → "Danes imate X terminov"
   */
  youHaveAppointmentsToday: (n: number) => {
    if (n === 0) return "Danes nimate terminov"
    if (n === 1) return "Danes imate 1 termin"
    if (n === 2) return `Danes imate ${n} termina`
    if (n === 3 || n === 4) return `Danes imate ${n} termine`
    return `Danes imate ${n} terminov`
  },
  noAppointmentsToday: "Za danes ni razporejenih terminov",
  guest: "Gost",
  staffLabel: "Osebje:",
  viewAllAppointments: "Prikaži vse termine",
  quickActions: "Hitra dejanja",
  commonTasks: "Pogosta opravila in bližnjice",
  newAppointment: "Nov termin",
  addProduct: "Dodaj izdelek",
  manageCustomers: "Upravljanje strank",
  recentActivity: "Nedavna dejavnost",
  noRecentActivity: "Ni nedavne dejavnosti",
  activity: {
    appointment: (name: string) => `Nova rezervacija: ${name}`,
    order: (name: string) => `Zaključeno naročilo: ${name}`,
    customer: (name: string) => `Nova stranka: ${name}`,
  },
  shareLink: {
    title: "Vaša povezava za stranke",
    description:
      "To je javni naslov vaše spletne strani. Prilepite ga, kamor koli želite nove stranke.",
    copy: "Kopiraj povezavo",
    copied: "Povezava kopirana!",
    copyFailed: "Kopiranje ni uspelo — povezavo označite in kopirajte ročno.",
    instagramTitle: "Instagram",
    instagramTip:
      "Prilepite povezavo v svojo Instagram bio — to je najmočnejši brezplačni kanal za nove stranke.",
    googleTitle: "Google Business Profile",
    googleTip:
      "Dodajte povezavo k svojemu Google poslovnemu profilu, da vas stranke najdejo v iskanju in na zemljevidu.",
    openGoogle: "Upravljaj Google profil",
  },
}

export type DashboardDict = typeof dashboardSl

export const dashboardEn: DashboardDict = {
  title: "Admin",
  titleAccent: "Dashboard",
  welcome: "Welcome back! Here's your business overview.",
  revenueThisMonth: "Revenue (This Month)",
  appointments: "Appointments",
  totalCustomers: "Total Customers",
  shopSales: "Shop Sales",
  fromLastMonth: "from last month",
  noPreviousData: "No previous data",
  thisMonth: "this month",
  newThisWeek: "new this week",
  todaysAppointments: "Today's Appointments",
  youHaveAppointmentsToday: (n: number) =>
    `You have ${n} appointment${n !== 1 ? "s" : ""} today`,
  noAppointmentsToday: "No appointments scheduled for today",
  guest: "Guest",
  staffLabel: "Staff:",
  viewAllAppointments: "View All Appointments",
  quickActions: "Quick Actions",
  commonTasks: "Common tasks and shortcuts",
  newAppointment: "New Appointment",
  addProduct: "Add Product",
  manageCustomers: "Manage Customers",
  recentActivity: "Recent Activity",
  noRecentActivity: "No recent activity",
  activity: {
    appointment: (name: string) => `New booking: ${name}`,
    order: (name: string) => `Order completed: ${name}`,
    customer: (name: string) => `New customer: ${name}`,
  },
  shareLink: {
    title: "Your customer-facing link",
    description:
      "This is the public address of your website. Paste it wherever you want new customers to come from.",
    copy: "Copy link",
    copied: "Link copied!",
    copyFailed: "Copy failed — select the link and copy it manually.",
    instagramTitle: "Instagram",
    instagramTip:
      "Paste the link into your Instagram bio — the strongest free channel for new customers.",
    googleTitle: "Google Business Profile",
    googleTip:
      "Add the link to your Google Business Profile so customers can find you in Search and on Maps.",
    openGoogle: "Manage Google profile",
  },
}

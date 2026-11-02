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
  setupChecklist: {
    title: "Vodena namestitev",
    subtitle:
      "Nekaj korakov do popolnoma pripravljene strani — vsi podatki podjetja so varni, ko ste kot na svojem domu.",
    progressFormat: "{done} od {total} korakov",
    progressAllDone: "Vse opravljeno",
    nextStep: "Naslednji korak",
    dismiss: "Skrij",
    dismissDescription: "Kontrolni seznam lahko kadarkoli znova odprete tukaj.",
    collapse: "Skrči",
    expand: "Razpri",
    reopen: "Pokaži vodeno namestitev",
    completedTitle: "Vse pripravljeno! 🎉",
    completedNote:
      "Namestitev je zaključena — vodeni vstop za zamenjavo dejavnosti je še vedno en klik stran.",
    steps: {
      vertical: {
        label: "Izberite dejavnost",
        description: "Povlecite delovno površino na svojo panogo — moduli, terminologija in obrazci se prilagodijo.",
        cta: "Zaženi vodeni vstop",
      },
      catalog: {
        label: "Prilagodite katalog svoji ponudbi",
        description: "Vzorčne storitve in izdelki so pripravljeni — popravite cene, dodajte svoje.",
        cta: "Odpri katalog",
      },
      staff: {
        label: "Dodajte osebje",
        description: "Dodajte sodelavce in jim nastavite urnik ter dostop.",
        cta: "Dodaj osebje",
      },
      customers: {
        label: "Dodajte prvo stranko",
        description: "Stranke so osnova terminov, naročil in sporočanja.",
        cta: "Dodaj stranko",
      },
      publish: {
        label: "Objavite svojo stran",
        description: "Objavljena stran je vidna strankam in odprta za rezervacije.",
        cta: "Odpri nastavitve objave",
      },
      firstJob: {
        label: "Sprejmite prvi termin",
        description: "Prvi rezerviran termin je trenutek, ko aplikacija res začne služiti vam.",
        cta: "Nov termin",
      },
      firstJobOrder: {
        label: "Zaključite prvo delovno naročilo",
        description: "Prvo naročilo je trenutek, ko aplikacija res začne služiti vam.",
        cta: "Nova naročila",
      },
    },
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
  setupChecklist: {
    title: "Guided setup",
    subtitle:
      "A few steps to a fully ready page — your data stays yours at every step.",
    progressFormat: "{done} of {total} steps",
    progressAllDone: "All done",
    nextStep: "Next step",
    dismiss: "Hide",
    dismissDescription: "You can reopen the checklist here at any time.",
    collapse: "Collapse",
    expand: "Expand",
    reopen: "Show guided setup",
    completedTitle: "All set! 🎉",
    completedNote:
      "Setup is complete — the guided entry for switching activities stays one click away.",
    steps: {
      vertical: {
        label: "Choose your activity",
        description: "Tailor the workspace to your trade — modules, terminology and forms follow.",
        cta: "Start guided entry",
      },
      catalog: {
        label: "Tailor the catalog to your offer",
        description: "Sample services and products are ready — adjust prices and add your own.",
        cta: "Open catalog",
      },
      staff: {
        label: "Add your team",
        description: "Add colleagues and set their schedule and access.",
        cta: "Add staff",
      },
      customers: {
        label: "Add your first customer",
        description: "Customers are the basis of bookings, orders and messaging.",
        cta: "Add customer",
      },
      publish: {
        label: "Publish your page",
        description: "A published page is visible to customers and open for bookings.",
        cta: "Open publishing settings",
      },
      firstJob: {
        label: "Take your first booking",
        description: "The first appointment is when the app truly starts working for you.",
        cta: "New appointment",
      },
      firstJobOrder: {
        label: "Complete your first work order",
        description: "The first order is when the app truly starts working for you.",
        cta: "New orders",
      },
    },
  },
}

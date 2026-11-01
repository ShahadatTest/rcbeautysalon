// ============================================================
// PLATFORM CONSOLE LABELS (EPIC #3 E3-5)
// Bilingual (sl/en) label registry for the operator console.
// Deliberately separate from the admin dictionaries: the platform
// console is a distinct surface (docs/EPIC-3/PLAN.md E3-5) and
// must not entangle tenant-facing terminology.
// Client-safe: no server-only imports.
// ============================================================

import type { Locale } from "@/lib/i18n/config"

export interface PlatformLabels {
  title: string
  subtitle: string
  signOut: string
  operator: string
  // Overview stats
  statsTenants: string
  statsActive: string
  statsSuspended: string
  statsPublished: string
  statsDrafts: string
  statsSubsActive: string
  statsPastDue: string
  billingConfigured: string
  billingNotConfigured: string
  // Tenant table
  tenantsHeading: string
  searchPlaceholder: string
  search: string
  filterAll: string
  filterActive: string
  filterSuspended: string
  colTenant: string
  colPlan: string
  colStatus: string
  colPublish: string
  colSubscription: string
  colUsers: string
  colCreated: string
  colActions: string
  emptyTenants: string
  detail: string
  suspend: string
  reactivate: string
  // Badges / values
  statusACTIVE: string
  statusSUSPENDED: string
  publishDRAFT: string
  publishPUBLISHED: string
  publishUNPUBLISHED: string
  subNone: string
  // Suspend dialog
  suspendTitle: string
  suspendDescription: string
  reasonLabel: string
  reasonPlaceholder: string
  confirmSuspend: string
  cancel: string
  // Reactivate dialog
  reactivateTitle: string
  reactivateDescription: string
  reasonOptionalLabel: string
  confirmReactivate: string
  // Toasts / errors
  toastSuspended: string
  toastReactivated: string
  errorInvalidReason: string
  errorInvalidTransition: string
  errorNotFound: string
  errorGeneric: string
  // Audit trail
  auditHeading: string
  auditEmpty: string
  auditColWhen: string
  auditColActor: string
  auditColAction: string
  auditColReason: string
  auditActionTENANT_SUSPENDED: string
  auditActionTENANT_REACTIVATED: string
  // Detail page
  backToOverview: string
  overviewHeading: string
  infoHeading: string
  usersHeading: string
  planHeading: string
  limitsHeading: string
  usageHeading: string
  subscriptionHeading: string
  publicationHeading: string
  billingHistoryHeading: string
  billingHistoryEmpty: string
  noSubscription: string
  subStatus: string
  subPlan: string
  subPeriod: string
  subCancelAtEnd: string
  subPending: string
  suspendedReasonHeading: string
  suspendedSince: string
  notPublishedYet: string
  versionLabel: string
  publishedVersionLabel: string
  limitServices: string
  limitProducts: string
  limitStaff: string
  limitStorage: string
  unlimited: string
  userColName: string
  userColEmail: string
  userColRole: string
  roleADMIN: string
  roleSTAFF: string
  roleCLIENTE: string
  openPublicSite: string
  createdAt: string
  slug: string
  vertical: string
  subscriptionNever: string
  // Analytics (E4-1)
  analyticsHeading: string
  analyticsDescription: string
  analyticsPlanDistribution: string
  analyticsConversion: string
  analyticsConversionDef: string
  analyticsChurn: string
  analyticsChurnDef: string
  analyticsRevenue: string
  analyticsRevenueDef: string
  analyticsWebhookHealth: string
  analyticsWebhookDef: string
  analyticsNoSubscriptions: string
  analyticsNoRevenue: string
  analyticsNoEvents: string
  analyticsLastEvent: string
  analyticsOtherTypesNote: string
  analyticsMonthOf: string
}

const sl: PlatformLabels = {
  title: "Operaterska konzola",
  subtitle: "Platforma — upravljanje najemnikov",
  signOut: "Odjava",
  operator: "Operater",
  statsTenants: "Najemniki",
  statsActive: "Aktivni",
  statsSuspended: "Ustavljeni",
  statsPublished: "Objavljeni",
  statsDrafts: "Osnutki",
  statsSubsActive: "Aktivne naročnine",
  statsPastDue: "Zapadle naročnine",
  billingConfigured: "Plačilni sloj: konfiguriran",
  billingNotConfigured: "Plačilni sloj: ni konfiguriran",
  tenantsHeading: "Najemniki",
  searchPlaceholder: "Išči po imenu ali slug …",
  search: "Išči",
  filterAll: "Vsi",
  filterActive: "Aktivni",
  filterSuspended: "Ustavljeni",
  colTenant: "Najemnik",
  colPlan: "Paket",
  colStatus: "Status",
  colPublish: "Objava",
  colSubscription: "Naročnina",
  colUsers: "Uporabniki",
  colCreated: "Ustvarjen",
  colActions: "Dejanja",
  emptyTenants: "Ni najemnikov za te filtre.",
  detail: "Podrobnosti",
  suspend: "Ustavi",
  reactivate: "Reaktiviraj",
  statusACTIVE: "Aktiven",
  statusSUSPENDED: "Ustavljen",
  publishDRAFT: "Osnutek",
  publishPUBLISHED: "Objavljeno",
  publishUNPUBLISHED: "Nepublikirano",
  subNone: "—",
  suspendTitle: "Ustavi najemnika",
  suspendDescription:
    "Javna stran najemnika takoj pokaže vzdrževalno stran. Dejanje se zapiše v revizijsko sled.",
  reasonLabel: "Razlog (obvezen)",
  reasonPlaceholder: "npr. neplačan račun, kršitev pogojev …",
  confirmSuspend: "Ustavi najemnika",
  cancel: "Prekliči",
  reactivateTitle: "Reaktiviraj najemnika",
  reactivateDescription:
    "Javna stran postane spet dostopna. Dejanje se zapiše v revizijsko sled.",
  reasonOptionalLabel: "Razlog (neobvezen)",
  confirmReactivate: "Reaktiviraj najemnika",
  toastSuspended: "Najemnik je ustavljen.",
  toastReactivated: "Najemnik je reaktiviran.",
  errorInvalidReason: "Razlog je obvezen (vsaj 3 znaki, največ 500).",
  errorInvalidTransition: "Dejanje ni veljavno za trenutno stanje.",
  errorNotFound: "Najemnik ne obstaja.",
  errorGeneric: "Dejanje ni uspelo. Poskusite znova.",
  auditHeading: "Revizijska sled",
  auditEmpty: "Ni zapisov.",
  auditColWhen: "Kdaj",
  auditColActor: "Kdo",
  auditColAction: "Dejanje",
  auditColReason: "Razlog",
  auditActionTENANT_SUSPENDED: "Najemnik ustavljen",
  auditActionTENANT_REACTIVATED: "Najemnik reaktiviran",
  backToOverview: "← Nazaj na pregled",
  overviewHeading: "Pregled",
  infoHeading: "Osnovni podatki",
  usersHeading: "Uporabniki",
  planHeading: "Paket",
  limitsHeading: "Omejitve paketa",
  usageHeading: "Raba",
  subscriptionHeading: "Naročnina (platforma)",
  publicationHeading: "Objava",
  billingHistoryHeading: "Zgodovina obračunavanja",
  billingHistoryEmpty: "Ni dogodkov obračunavanja.",
  noSubscription: "Najemnik nima naročnine na platformo.",
  subStatus: "Status",
  subPlan: "Paket",
  subPeriod: "Obdobje",
  subCancelAtEnd: "Preklic na koncu obdobja",
  subPending: "V teku: checkout za paket",
  suspendedReasonHeading: "Razlog ustavitve",
  suspendedSince: "Ustavljeno",
  notPublishedYet: "Še ni bilo objavljeno",
  versionLabel: "Različica vsebine",
  publishedVersionLabel: "Objavljena različica",
  limitServices: "Storitve",
  limitProducts: "Izdelki",
  limitStaff: "Zaposleni",
  limitStorage: "Prostor (MB)",
  unlimited: "neomejeno",
  userColName: "Ime",
  userColEmail: "E-pošta",
  userColRole: "Vloga",
  roleADMIN: "Administrator",
  roleSTAFF: "Zaposleni",
  roleCLIENTE: "Stranka",
  openPublicSite: "Odpri javno stran",
  createdAt: "Ustvarjeno",
  slug: "Slug",
  vertical: "Dejavnost",
  subscriptionNever: "ni nikoli",
  analyticsHeading: "Analitika",
  analyticsDescription:
    "Izpeljano iz obstoječih tabel v trenutnem pogledu — ni ločenih števcev, številke ne more odstopati od podatkov.",
  analyticsPlanDistribution: "Distribucija paketov",
  analyticsConversion: "Konverzija",
  analyticsConversionDef:
    "plačujoči (ACTIVE/TRIALING) ÷ najemniki z naročnino — brez naročnin ni deleža, ne 0 %",
  analyticsChurn: "Odhod",
  analyticsChurnDef: "CANCELED/UNPAID naročnine ÷ vse naročnine",
  analyticsRevenue: "Prihodki (mesec)",
  analyticsRevenueDef:
    "vsota invoice.paid po zabeleženi valuti — checkout dogodki niso sešteti (prvi mesec bi podvojili plačilo)",
  analyticsWebhookHealth: "Webhook (7 dni)",
  analyticsWebhookDef: "število dogodkov obračunavanja v zadnjih 7 dneh — merilo živosti webhooka",
  analyticsNoSubscriptions: "Ni naročnin — delež ni izračunan.",
  analyticsNoRevenue: "Ni plačanih računov ta mesec.",
  analyticsNoEvents: "Ni dogodkov obračunavanja.",
  analyticsLastEvent: "Zadnji dogodek",
  analyticsOtherTypesNote: "drugi dogodki (nesešteti)",
  analyticsMonthOf: "od",
}

const en: PlatformLabels = {
  title: "Operator console",
  subtitle: "Platform — tenant administration",
  signOut: "Sign out",
  operator: "Operator",
  statsTenants: "Tenants",
  statsActive: "Active",
  statsSuspended: "Suspended",
  statsPublished: "Published",
  statsDrafts: "Drafts",
  statsSubsActive: "Active subscriptions",
  statsPastDue: "Past-due subscriptions",
  billingConfigured: "Billing layer: configured",
  billingNotConfigured: "Billing layer: not configured",
  tenantsHeading: "Tenants",
  searchPlaceholder: "Search by name or slug …",
  search: "Search",
  filterAll: "All",
  filterActive: "Active",
  filterSuspended: "Suspended",
  colTenant: "Tenant",
  colPlan: "Plan",
  colStatus: "Status",
  colPublish: "Publishing",
  colSubscription: "Subscription",
  colUsers: "Users",
  colCreated: "Created",
  colActions: "Actions",
  emptyTenants: "No tenants match these filters.",
  detail: "Details",
  suspend: "Suspend",
  reactivate: "Reactivate",
  statusACTIVE: "Active",
  statusSUSPENDED: "Suspended",
  publishDRAFT: "Draft",
  publishPUBLISHED: "Published",
  publishUNPUBLISHED: "Unpublished",
  subNone: "—",
  suspendTitle: "Suspend tenant",
  suspendDescription:
    "The tenant's public site will immediately show a maintenance page. The action is recorded in the audit trail.",
  reasonLabel: "Reason (required)",
  reasonPlaceholder: "e.g. unpaid invoice, terms violation …",
  confirmSuspend: "Suspend tenant",
  cancel: "Cancel",
  reactivateTitle: "Reactivate tenant",
  reactivateDescription:
    "The public site becomes accessible again. The action is recorded in the audit trail.",
  reasonOptionalLabel: "Reason (optional)",
  confirmReactivate: "Reactivate tenant",
  toastSuspended: "Tenant suspended.",
  toastReactivated: "Tenant reactivated.",
  errorInvalidReason: "A reason is required (3–500 characters).",
  errorInvalidTransition: "The action is not valid for the current state.",
  errorNotFound: "Tenant not found.",
  errorGeneric: "The action failed. Please try again.",
  auditHeading: "Audit trail",
  auditEmpty: "No entries.",
  auditColWhen: "When",
  auditColActor: "Actor",
  auditColAction: "Action",
  auditColReason: "Reason",
  auditActionTENANT_SUSPENDED: "Tenant suspended",
  auditActionTENANT_REACTIVATED: "Tenant reactivated",
  backToOverview: "← Back to overview",
  overviewHeading: "Overview",
  infoHeading: "Basic information",
  usersHeading: "Users",
  planHeading: "Plan",
  limitsHeading: "Plan limits",
  usageHeading: "Usage",
  subscriptionHeading: "Subscription (platform)",
  publicationHeading: "Publication",
  billingHistoryHeading: "Billing history",
  billingHistoryEmpty: "No billing events.",
  noSubscription: "This tenant has no platform subscription.",
  subStatus: "Status",
  subPlan: "Plan",
  subPeriod: "Period",
  subCancelAtEnd: "Cancels at period end",
  subPending: "Pending: checkout for plan",
  suspendedReasonHeading: "Suspension reason",
  suspendedSince: "Suspended",
  notPublishedYet: "Not published yet",
  versionLabel: "Content version",
  publishedVersionLabel: "Published version",
  limitServices: "Services",
  limitProducts: "Products",
  limitStaff: "Team members",
  limitStorage: "Storage (MB)",
  unlimited: "unlimited",
  userColName: "Name",
  userColEmail: "Email",
  userColRole: "Role",
  roleADMIN: "Administrator",
  roleSTAFF: "Staff",
  roleCLIENTE: "Customer",
  openPublicSite: "Open public site",
  createdAt: "Created",
  slug: "Slug",
  vertical: "Vertical",
  subscriptionNever: "never",
  analyticsHeading: "Analytics",
  analyticsDescription:
    "Derived from existing tables at view time — no separate counters, numbers cannot disagree with the data.",
  analyticsPlanDistribution: "Plan distribution",
  analyticsConversion: "Conversion",
  analyticsConversionDef:
    "paying (ACTIVE/TRIALING) ÷ tenants with a subscription — no subscriptions means no rate, not 0 %",
  analyticsChurn: "Churn",
  analyticsChurnDef: "CANCELED/UNPAID subscriptions ÷ all subscriptions",
  analyticsRevenue: "Revenue (month)",
  analyticsRevenueDef:
    "sum of invoice.paid per recorded currency — checkout events are not summed (first month would double-count)",
  analyticsWebhookHealth: "Webhook (7 days)",
  analyticsWebhookDef: "billing events received in the last 7 days — webhook liveness measure",
  analyticsNoSubscriptions: "No subscriptions — rate not computed.",
  analyticsNoRevenue: "No paid invoices this month.",
  analyticsNoEvents: "No billing events.",
  analyticsLastEvent: "Last event",
  analyticsOtherTypesNote: "other events (not summed)",
  analyticsMonthOf: "since",
}

export function getPlatformLabels(locale: Locale): PlatformLabels {
  return locale === "en" ? en : sl
}

export function auditActionLabel(
  action: string,
  labels: PlatformLabels
): string {
  if (action === "TENANT_SUSPENDED") return labels.auditActionTENANT_SUSPENDED
  if (action === "TENANT_REACTIVATED") return labels.auditActionTENANT_REACTIVATED
  return action
}

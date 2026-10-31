// Popolnoma prevedi ta imenski prostor (slovenščina + angleščina).
// E2-3: projekti in naloge — večdnevski posli z roki, nalogami
// in povezavo na delovno naročilo.
export const projectsSl = {
  // Naslovi strani
  title: "Projekti",
  titleAccent: "in naloge",
  welcome: "Večdnevski posli z nalogami, roki in odgovornimi osebami.",
  newProject: "Nov projekt",
  backToProjects: "Nazaj na projekte",
  editProject: "Uredi projekt",

  // Povzetek (stat kartice)
  statsActive: "Aktivni projekti",
  statsOverdue: "Zakasneli",
  statsDueSoon: "Rok v 7 dneh",
  statsCompleted: "Zaključeni ta mesec",

  // Statusi projekta
  statusPlanning: "Načrtovanje",
  statusInProgress: "V teku",
  statusCompleted: "Zaključen",
  statusCancelled: "Preklican",

  // Statusi nalog
  taskOpen: "Odprto",
  taskInProgress: "V teku",
  taskDone: "Zaključeno",

  // Akcije statusa
  startWork: "Prični delo",
  completeProject: "Zaključi projekt",
  cancelProject: "Prekliči projekt",
  reopen: "Ponovno odpri",
  markDone: "Označi kot zaključeno",
  startTask: "Prični nalogo",

  // Tabela / seznam
  colProject: "Projekt",
  colCustomer: "Stranka",
  colDeadline: "Rok",
  colProgress: "Napredek",
  colStatus: "Status",
  colTasks: "Naloge",
  noProjects: "Ni še nobenega projekta. Ustvarite prvega z gumbom „Nov projekt“.",
  noProjectsFiltered: "Ni projektov za izbrani filter.",
  filterAll: "Vsi",
  taskCountOf: "od",
  noDeadline: "Brez roka",
  overdueBadge: "Zakasnel",
  dueSoonBadge: "Rok v 7 dneh",

  // Podrobnosti projekta
  overviewSection: "Pregled",
  tasksSection: "Naloge",
  startDate: "Začetek",
  deadlineLabel: "Rok izvedbe",
  budgetLabel: "Proračun",
  workOrderLabel: "Delovno naročilo",
  workOrderShort: "DN",
  customerLabel: "Stranka",
  notesLabel: "Opombe",
  noNotes: "Ni opomb.",
  progressLabel: "Napredek",
  progressDone: "zaključenih",
  deleteProject: "Izbriši projekt",
  deleteProjectConfirm: "Res želite izbrisati ta projekt? Naloge bodo izbrisane skupaj z njim. Tega ni mogoče razveljaviti.",
  completionBlocked: "Projekta ni mogoče zaključiti — še vedno so odprte naloge. Zaključite jih najprej.",
  invalidTransition: "Ta sprememba statusa ni dovoljena.",
  projectDeleted: "Projekt izbrisan.",
  notFound: "Projekt ne obstaja ali ni vaš.",

  // Obrazec projekta
  nameLabel: "Naziv projekta *",
  namePlaceholder: "npr. Spletna trgovina — faza 1",
  customerPlaceholder: "Izbirno — iz evidenc strank",
  workOrderPlaceholder: "Izbirno — poveži delovno naročilo",
  budgetPlaceholder: "npr. 1200",
  notesPlaceholder: "Dogovori, posebnosti, material …",
  submitProject: "Shrani projekt",
  cancelEdit: "Prekliči",
  optionalSection: "Izbirne povezave",

  // Naloge
  addTask: "Dodaj nalogo",
  taskTitleLabel: "Naslov naloge *",
  taskTitlePlaceholder: "npr. Priprava lokacije in opreme",
  taskDueDate: "Rok",
  taskAssignee: "Odgovorna oseba",
  taskAssigneePlaceholder: "npr. Ana",
  taskHours: "Predvidene ure",
  taskNotes: "Opombe",
  submitTask: "Dodaj nalogo",
  saveTask: "Shrani nalogo",
  editTask: "Uredi nalogo",
  deleteTask: "Izbriši",
  noTasks: "Ni še nalog. Dodajte prvo s klikom na „Dodaj nalogo“.",
  tasksDoneCount: "zaključenih nalog",
  taskOverdue: "po roku",
  taskDeleted: "Naloga izbrisana.",

  // Napake (server kodi → besedilo)
  errValidation: "Preverite vnesene podatke (obvezna polja, dolžine).",
  errNotFound: "Projekt/naloga ne obstaja ali ni vaša.",
  errExtensionOff: "Modul projekti ni vklopljen za ta račun.",
  errLinkMismatch: "Povezana stranka/delovno naročilo ne pripada temu računu.",
  errTransition: "Ta sprememba statusa ni dovoljena.",
  errTasksOpen: "Projekta ni mogoče zaključiti — zaključite najprej vse naloge.",
  errGeneric: "Prišlo je do napake. Poskusite znova.",
}

export type ProjectsDict = typeof projectsSl

export const projectsEn: ProjectsDict = {
  // Page titles
  title: "Projects",
  titleAccent: "& tasks",
  welcome: "Multi-day jobs with tasks, deadlines and assignees.",
  newProject: "New project",
  backToProjects: "Back to projects",
  editProject: "Edit project",

  // Summary (stat cards)
  statsActive: "Active projects",
  statsOverdue: "Overdue",
  statsDueSoon: "Due within 7 days",
  statsCompleted: "Completed this month",

  // Project statuses
  statusPlanning: "Planning",
  statusInProgress: "In progress",
  statusCompleted: "Completed",
  statusCancelled: "Cancelled",

  // Task statuses
  taskOpen: "Open",
  taskInProgress: "In progress",
  taskDone: "Done",

  // Status actions
  startWork: "Start work",
  completeProject: "Complete project",
  cancelProject: "Cancel project",
  reopen: "Reopen",
  markDone: "Mark as done",
  startTask: "Start task",

  // Table / list
  colProject: "Project",
  colCustomer: "Customer",
  colDeadline: "Deadline",
  colProgress: "Progress",
  colStatus: "Status",
  colTasks: "Tasks",
  noProjects: "No projects yet. Create the first one with “New project”.",
  noProjectsFiltered: "No projects match the selected filter.",
  filterAll: "All",
  taskCountOf: "of",
  noDeadline: "No deadline",
  overdueBadge: "Overdue",
  dueSoonBadge: "Due within 7 days",

  // Project detail
  overviewSection: "Overview",
  tasksSection: "Tasks",
  startDate: "Start",
  deadlineLabel: "Deadline",
  budgetLabel: "Budget",
  workOrderLabel: "Work order",
  workOrderShort: "WO",
  customerLabel: "Customer",
  notesLabel: "Notes",
  noNotes: "No notes.",
  progressLabel: "Progress",
  progressDone: "done",
  deleteProject: "Delete project",
  deleteProjectConfirm: "Really delete this project? Its tasks will be deleted with it. This cannot be undone.",
  completionBlocked: "The project cannot be completed — there are still open tasks. Finish them first.",
  invalidTransition: "This status change is not allowed.",
  projectDeleted: "Project deleted.",
  notFound: "This project does not exist or is not yours.",

  // Project form
  nameLabel: "Project name *",
  namePlaceholder: "e.g. Online store — phase 1",
  customerPlaceholder: "Optional — from customer records",
  workOrderPlaceholder: "Optional — link a work order",
  budgetPlaceholder: "e.g. 1200",
  notesPlaceholder: "Agreements, specifics, material …",
  submitProject: "Save project",
  cancelEdit: "Cancel",
  optionalSection: "Optional links",

  // Tasks
  addTask: "Add task",
  taskTitleLabel: "Task title *",
  taskTitlePlaceholder: "e.g. Prepare location and equipment",
  taskDueDate: "Due",
  taskAssignee: "Assignee",
  taskAssigneePlaceholder: "e.g. Ana",
  taskHours: "Estimated hours",
  taskNotes: "Notes",
  submitTask: "Add task",
  saveTask: "Save task",
  editTask: "Edit task",
  deleteTask: "Delete",
  noTasks: "No tasks yet. Add the first one with “Add task”.",
  tasksDoneCount: "tasks done",
  taskOverdue: "past due",
  taskDeleted: "Task deleted.",

  // Errors (server codes → text)
  errValidation: "Check the entered data (required fields, lengths).",
  errNotFound: "The project/task does not exist or is not yours.",
  errExtensionOff: "The projects module is not enabled for this account.",
  errLinkMismatch: "The linked customer/work order does not belong to this account.",
  errTransition: "This status change is not allowed.",
  errTasksOpen: "The project cannot be completed — finish all tasks first.",
  errGeneric: "Something went wrong. Please try again.",
}

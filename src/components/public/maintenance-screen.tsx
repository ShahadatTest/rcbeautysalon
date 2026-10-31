/**
 * Neutral maintenance screen for tenants whose site is not published
 * (EPIC #3 E3-1). Deliberately shows NO tenant data — not even the
 * business name — so drafts stay private.
 */
export function MaintenanceScreen() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-24 text-center">
      <div className="bg-muted text-muted-foreground mb-6 flex size-16 items-center justify-center rounded-full">
        <svg
          className="size-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold md:text-3xl">Stran ni objavljena</h1>
      <p className="text-muted-foreground mt-3 max-w-md">
        Ta spletna stran je v pripravi ali pa je bila začasno umaknjena.
        Prosimo, obiščite nas kasneje.
      </p>
    </div>
  )
}

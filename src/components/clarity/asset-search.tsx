// Placeholder search field for the Overview topbar. Non-functional in v0 —
// wiring (Ctrl+K palette or a client-side holdings filter) is a follow-up.
// Kept as a static server component so it costs zero client JS until we wire
// real search behavior.

export function AssetSearch() {
  return (
    <div
      className="hidden md:flex items-center gap-2.5 bg-[#17181B] rounded-xl px-4 py-2.5 w-[280px] text-[#7d8085] text-sm cursor-not-allowed opacity-70"
      role="search"
      aria-label="Search assets (coming soon)"
      title="Search coming soon"
    >
      <span className="text-base">⌕</span>
      <span>Search assets…</span>
    </div>
  );
}

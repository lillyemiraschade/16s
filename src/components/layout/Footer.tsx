export function Footer() {
  return (
    <footer className="border-t border-zinc-800/50 py-6 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between text-[11px] text-zinc-500">
        <span>&copy; 2026 16s</span>
        <div className="flex items-center gap-4">
          <a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-zinc-300 transition-colors">Terms</a>
          <a href="mailto:hello@try16s.app" className="hover:text-zinc-300 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

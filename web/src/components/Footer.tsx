export function Footer() {
  return (
    <footer className="border-t border-black/5 dark:border-white/5 mt-32">
      <div className="mx-auto max-w-7xl px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-12 text-sm text-ink-soft dark:text-paper/70">
        <div>
          <p className="font-semibold text-ink dark:text-paper mb-4">vinex22</p>
          <p className="text-xs leading-relaxed">Travel, considered.<br/>Engineered for the long itinerary.</p>
        </div>
        <div>
          <p className="font-semibold text-ink dark:text-paper mb-4">Shop</p>
          <ul className="space-y-2 text-xs">
            <li>Carry</li><li>Rest</li><li>Pack</li><li>Care</li><li>Tech</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink dark:text-paper mb-4">Service</p>
          <ul className="space-y-2 text-xs">
            <li>Lifetime guarantee</li><li>Free repairs</li><li>Returns</li><li>Contact</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink dark:text-paper mb-4">Brand</p>
          <ul className="space-y-2 text-xs">
            <li>Story</li><li>Materials</li><li>Sustainability</li><li>Press</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-black/5 dark:border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-6 flex justify-between text-xs text-ink-mute">
          <span>© 2026 vinex22-travels</span>
          <span>Built on Azure · AKS Automatic</span>
        </div>
      </div>
    </footer>
  );
}

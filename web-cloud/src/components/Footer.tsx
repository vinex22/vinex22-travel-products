import Link from 'next/link';

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
            <li><Link href="/carry" className="hover:text-ink dark:hover:text-paper transition-colors">Carry</Link></li>
            <li><Link href="/rest" className="hover:text-ink dark:hover:text-paper transition-colors">Rest</Link></li>
            <li><Link href="/pack" className="hover:text-ink dark:hover:text-paper transition-colors">Pack</Link></li>
            <li><Link href="/care" className="hover:text-ink dark:hover:text-paper transition-colors">Care</Link></li>
            <li><Link href="/tech" className="hover:text-ink dark:hover:text-paper transition-colors">Tech</Link></li>
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
            <li><Link href="/story" className="hover:text-ink dark:hover:text-paper transition-colors">Story</Link></li>
            <li>Materials</li><li>Sustainability</li><li>Press</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-black/5 dark:border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-6 flex justify-between text-xs text-ink-mute">
          <span>© 2026 vinex22-travels</span>
          <span>Created by <a href="mailto:vinex22@gmail.com" className="hover:text-ink dark:hover:text-paper transition-colors">vinex22@gmail.com</a> · <a href="mailto:vinayjain@microsoft.com" className="hover:text-ink dark:hover:text-paper transition-colors">vinayjain@microsoft.com</a></span>
        </div>
      </div>
    </footer>
  );
}

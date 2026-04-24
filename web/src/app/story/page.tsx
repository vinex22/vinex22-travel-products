import Image from 'next/image';

export default function StoryPage() {
  return (
    <>
      <section
        className="parallax h-[80vh] flex items-end"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-section-lake.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"/>
        <div className="relative mx-auto max-w-7xl px-6 pb-24 text-white animate-fade-up">
          <p className="eyebrow text-white/80 mb-3">Our story</p>
          <h1 className="headline text-6xl md:text-8xl max-w-3xl">A studio for<br/>the long itinerary.</h1>
        </div>
      </section>

      <section className="bg-paper dark:bg-black py-32">
        <div className="mx-auto max-w-3xl px-6 text-lg text-ink-soft dark:text-paper/80 font-light leading-relaxed space-y-8">
          <p>vinex22-travels began as a question: what would travel essentials look like if they were specified the way furniture is — to outlast you, to be repairable, to develop character?</p>
          <p>Our pieces are designed in a small studio. Materials are chosen first, hardware second, finish last. Nothing is added that doesn't earn its place. The line is small on purpose.</p>
          <p>Every piece carries a lifetime guarantee. We will repair it if you'll let us. We'd prefer to.</p>
        </div>
      </section>

      <section className="bg-paper-warm dark:bg-neutral-950 py-24">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-8">
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
            <Image src="/images/backdrop-tall/backdrop-campaign-cabin.png" alt="Cabin" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw"/>
          </div>
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
            <Image src="/images/backdrop-tall/backdrop-campaign-snow.png" alt="Snow" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw"/>
          </div>
        </div>
      </section>

      <section
        className="parallax h-[60vh] flex items-center justify-center"
        style={{ backgroundImage: "url('/images/backdrop-wide/backdrop-section-desert.png')" }}
      >
        <div className="text-center text-white px-6">
          <h2 className="headline text-4xl md:text-6xl max-w-3xl">Pack lighter.<br/>Travel longer.</h2>
        </div>
      </section>
    </>
  );
}

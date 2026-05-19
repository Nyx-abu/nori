import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | Nori',
  description: 'About Nori - the visual AI tool discovery platform.',
}

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-accent-pink px-4 py-16 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto max-w-3xl rounded-[40px] border-4 border-border bg-surface p-8 sm:p-12 shadow-[12px_12px_0px_#1A1A1A]">
        <div className="mb-6 inline-block rounded-pill border-2 border-border bg-accent px-4 py-1 text-sm font-bold text-surface shadow-[2px_2px_0px_#1A1A1A]">
          Our Story
        </div>
        <h1 className="mb-8 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
          Why we built <span className="text-accent">Nori</span>
        </h1>
        
        <div className="space-y-6 text-lg leading-relaxed text-text-secondary font-medium">
          <p>
            Nori is a true passion project. I personally faced the lack of AI tool finders that were actually intuitive, visually pleasing, and most importantly—not boring. 
          </p>
          <p>
            Every directory out there felt like a massive spreadsheet. I wanted to build something that felt alive, visual-first, and let you search using natural language without needing to know exact keywords or dig through endless category trees.
          </p>
          <p>
            So I built Nori. Just tell it what you want to do, and it finds the perfect AI tool for you using semantic embeddings and live AI discovery.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border-4 border-border bg-accent-glow p-6 shadow-[6px_6px_0px_#1A1A1A]">
          <h2 className="mb-4 text-2xl font-bold text-text-primary">Get in Touch</h2>
          <ul className="space-y-3 font-bold text-text-primary">
            <li className="flex items-center gap-3">
              <span className="text-2xl">✉️</span>
              <a href="mailto:abudoescoding123@gmail.com" className="hover:underline">abudoescoding123@gmail.com</a>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-2xl">📞</span>
              <a href="tel:+918072547648" className="hover:underline">+91 8072547648</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

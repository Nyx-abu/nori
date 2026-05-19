export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-2xs text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex gap-4">
          <p>Nori — find AI tools by what they do</p>
          <a href="/about" className="hover:text-text-primary hover:underline transition-colors">About</a>
        </div>
        <p>Search powered by Gemini embeddings + pgvector</p>
      </div>
    </footer>
  )
}

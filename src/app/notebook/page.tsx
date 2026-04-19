import Link from "next/link";
import { getAllPosts } from "@/lib/notebook";
import { SubscribeForm } from "@/components/subscribe-form";

export const metadata = {
  title: "Notebook — Marble Ma",
  description: "Notes on building products in regulated markets.",
};

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function NotebookIndex() {
  const posts = getAllPosts();
  return (
    <div className="marbs-personal relative z-10 min-h-screen" style={{ background: "#f6f4ef", color: "#121212" }}>
      <div className="max-w-[680px] mx-auto px-6 sm:px-8">
        <header className="flex items-center justify-between pt-8 pb-16">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">marbs.io</Link>
          <nav className="flex items-center gap-6 text-[14px] text-neutral-600">
            <Link href="/" className="hover:text-black transition-colors">Home</Link>
            <Link href="/notebook" className="text-black">Notebook</Link>
            <a href="mailto:marble.mpc@gmail.com" className="hover:text-black transition-colors">Contact</a>
          </nav>
        </header>

        <section className="pb-12">
          <h1 className="font-display text-[40px] sm:text-[48px] font-semibold tracking-tight leading-[1.05]">
            The Notebook
          </h1>
          <p className="mt-4 text-[17px] leading-[1.6] text-neutral-700 max-w-[520px]">
            Occasional notes on shipping in regulated markets, scaling crypto platforms,
            and the operational systems I use.
          </p>
        </section>

        <section className="pb-16">
          {posts.length === 0 ? (
            <p className="text-neutral-500 text-[15px]">No posts yet — check back soon.</p>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/notebook/${p.slug}`} className="block py-6 group">
                    <div className="flex items-baseline justify-between gap-6 mb-1">
                      <h2 className="font-display text-[20px] font-semibold tracking-tight group-hover:text-neutral-600 transition-colors">
                        {p.title}
                      </h2>
                      <span className="text-[12px] font-mono text-neutral-500 shrink-0">
                        {formatDate(p.date)}
                      </span>
                    </div>
                    <p className="text-[14px] text-neutral-600 leading-relaxed">{p.description}</p>
                    <div className="mt-2 text-[12px] text-neutral-500">{p.readingTime}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-20 rounded-2xl border border-neutral-200 bg-white p-7 sm:p-9">
          <h2 className="font-display text-[22px] font-semibold tracking-tight mb-2">Get posts by email</h2>
          <p className="text-[15px] text-neutral-600 leading-relaxed mb-5">
            One email when I publish. No spam, no fluff. Unsubscribe any time.
          </p>
          <SubscribeForm source="notebook" />
        </section>

        <footer className="py-10 border-t border-neutral-200 text-[13px] text-neutral-600">
          &copy; {new Date().getFullYear()} Marble Ma
        </footer>
      </div>
    </div>
  );
}

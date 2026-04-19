import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPosts, getPost } from "@/lib/notebook";
import { SubscribeForm } from "@/components/subscribe-form";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Notebook`,
    description: post.description,
  };
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function NotebookPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <div className="marbs-personal relative z-10 min-h-screen" style={{ background: "#f6f4ef", color: "#121212" }}>
      <div className="max-w-[680px] mx-auto px-6 sm:px-8">
        <header className="flex items-center justify-between pt-8 pb-16">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">marbs.io</Link>
          <nav className="flex items-center gap-6 text-[14px] text-neutral-600">
            <Link href="/" className="hover:text-black transition-colors">Home</Link>
            <Link href="/notebook" className="hover:text-black transition-colors">Notebook</Link>
            <a href="mailto:marble.mpc@gmail.com" className="hover:text-black transition-colors">Contact</a>
          </nav>
        </header>

        <article className="pb-16">
          <Link href="/notebook" className="text-[13px] text-neutral-500 hover:text-black transition-colors">
            ← All posts
          </Link>
          <h1 className="font-display text-[34px] sm:text-[40px] font-semibold tracking-tight leading-[1.1] mt-6">
            {post.title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-[13px] text-neutral-500">
            <span>{formatDate(post.date)}</span>
            <span>·</span>
            <span>{post.readingTime}</span>
          </div>

          <div className="prose-notebook mt-10">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>
        </article>

        <section className="mb-20 rounded-2xl border border-neutral-200 bg-white p-7 sm:p-9">
          <h2 className="font-display text-[22px] font-semibold tracking-tight mb-2">Get posts by email</h2>
          <p className="text-[15px] text-neutral-600 leading-relaxed mb-5">
            One email when I publish. No spam, no fluff.
          </p>
          <SubscribeForm source={`post:${post.slug}`} />
        </section>

        <footer className="py-10 border-t border-neutral-200 text-[13px] text-neutral-600">
          &copy; {new Date().getFullYear()} Marble Ma
        </footer>
      </div>
    </div>
  );
}

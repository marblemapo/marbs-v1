import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingTime: string;
};

export type Post = PostMeta & { content: string };

const POSTS_DIR = path.join(process.cwd(), "src/content/notebook");

function readingTime(markdown: string): string {
  const words = markdown.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const { data, content } = matter(raw);
    return {
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      date: String(data.date ?? ""),
      readingTime: readingTime(content),
    };
  });
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): Post | null {
  const file = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    readingTime: readingTime(content),
    content,
  };
}

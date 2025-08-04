import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)  }...`;
}

export function getSourceLogo(source: string): string {
  const sourceLogos: Record<string, string> = {
    "arxiv": "🔬",
    "github": "💻",
    "techcrunch": "🚀",
    "venturebeat": "💼",
    "theverge": "🌐",
    "default": "📰"
  };
  return sourceLogos[source?.toLowerCase() || 'default'] || sourceLogos.default;
}
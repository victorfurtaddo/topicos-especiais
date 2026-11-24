import { Badge } from "@/components/ui/badge";

const colors: Record<string, string> = {
  Alimentação: "coral",
  Moradia: "tangerine",
  Transporte: "olive",
  Saúde: "ember",
  Educação: "sunflower",
  Lazer: "violet",
  Compras: "pink",
  Assinaturas: "sky",
  Salário: "lime",
  Freelance: "blue",
  Outros: "slate",
};

export function categoryColor(category: string) {
  return `var(--tag-${colors[category] ?? "slate"})`;
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className="category-label">
      <span className="category-dot" aria-hidden style={{ backgroundColor: categoryColor(category) }} />
      {category}
    </Badge>
  );
}

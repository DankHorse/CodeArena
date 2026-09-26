type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <main className="placeholder-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}

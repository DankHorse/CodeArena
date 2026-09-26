type OrganizerPlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function OrganizerPlaceholderPage({
  eyebrow,
  title,
  description,
}: OrganizerPlaceholderPageProps) {
  return (
    <section className="organizer-placeholder">
      <p className="eyebrow">{eyebrow}</p>

      <h1 className="organizer-placeholder-title">
        {title}
        <span className="heading-period">.</span>
      </h1>

      <p className="workspace-description">
        {description}
      </p>
    </section>
  );
}

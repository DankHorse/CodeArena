import { ArrowUpRight } from 'lucide-react';

const moves = [
  { title: 'Keep reviews moving', description: '24 assigned reviews are still awaiting completion.' },
  { title: 'Check project coverage', description: 'Confirm every project has the review coverage it needs.' },
  { title: 'Prepare the final results', description: 'Review scores before publishing the leaderboard.' },
];

export function NextMoves() {
  return (
    <section className="panel" aria-labelledby="next-moves-title">
      <header className="panel-header"><h2 id="next-moves-title"><span>//</span> Next Moves</h2><span className="metadata">03 STEPS</span></header>
      <ol className="next-moves">
        {moves.map((move, index) => (
          <li key={move.title}>
            <span className="move-number">0{index + 1}</span>
            <div><h3>{move.title}</h3><p>{move.description}</p></div>
            <ArrowUpRight size={16} aria-hidden="true" />
          </li>
        ))}
      </ol>
    </section>
  );
}

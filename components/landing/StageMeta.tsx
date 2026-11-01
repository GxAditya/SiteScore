export function StageMeta({ left, right }: { left: string; right?: string }) {
  return (
    <div className="stage-meta" aria-hidden="true">
      <span className="stage-meta__left">
        <span className="led led--pulse" />
        {left}
      </span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

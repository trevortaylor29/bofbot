type Props = {
  onClick: () => void;
};

export function UpdateAvailableBadge({ onClick }: Props) {
  return (
    <button
      type="button"
      className="update-available-badge"
      onClick={onClick}
      aria-label="Update available. Open update dialog."
    >
      Update available
    </button>
  );
}

export default function Loading({ label = "불러오는 중" }: { label?: string }) {
  return <p role="status">{label}</p>;
}

export default function Loading() {
  return (
    <div className="fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden bg-red-dark/40">
      <div className="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-red" />
      <style>{`@keyframes slide{from{transform:translateX(-100%)}to{transform:translateX(400%)}}`}</style>
    </div>
  );
}

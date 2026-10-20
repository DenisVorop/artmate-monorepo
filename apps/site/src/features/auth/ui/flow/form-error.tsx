export function FormError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="text-sm leading-6 text-rose-700">
      {message}
    </p>
  );
}

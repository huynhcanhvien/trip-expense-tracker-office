// The inline error message shown under a form after a failed action. Renders
// nothing when there's no error, so callers can drop it in unconditionally.
export default function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="form-error">
      {message}
    </p>
  );
}

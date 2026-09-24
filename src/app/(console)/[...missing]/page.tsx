import { notFound } from 'next/navigation';

// Unknown addresses render the shell's not-found page rather than a bare one.
export default function MissingPage() {
  notFound();
}

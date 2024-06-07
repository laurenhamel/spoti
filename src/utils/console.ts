export function silenceWarnings(): () => void {
  const initial = console.warn;
  console.warn = () => {};
  return () => (console.warn = initial);
}

export function retryDelay(attempt: number): number {
  const delays = [5000, 30000, 300000];
  return delays[attempt] || 60000;
}
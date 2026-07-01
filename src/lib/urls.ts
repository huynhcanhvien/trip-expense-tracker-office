// App base URL for building absolute links (invites, email links).
export function baseUrl(): string {
  return process.env.AUTH_URL || "http://localhost:3000";
}

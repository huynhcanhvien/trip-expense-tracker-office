// App base URL for building absolute links (shareable trip URLs).
export function baseUrl(): string {
  return process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000";
}

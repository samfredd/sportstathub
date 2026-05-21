export {};

declare global {
  interface Error {
    statusCode?: number;
    status?: number;
  }
}

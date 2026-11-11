export {};

// Existing browser-only resources; declarations do not initialize or authorize them.
declare global {
  interface Window {
    __elsInflight?: Map<string, Promise<unknown[]>>;
    __elsCache?: Map<string, unknown[]>;
    __elsLastCallAt?: Map<string, number>;
    __elsCooldownUntil?: Map<string, number>;
    __elsEntityBusy?: Map<string, boolean>;
    __elsStrikeCount?: Map<string, number>;
    __currentOpenWindow?: (component: unknown, props?: object, options?: object) => string;
  }
}

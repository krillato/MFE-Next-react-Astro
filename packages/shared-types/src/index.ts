export type MountResult = { unmount: () => void };
export type MountFn = (el: HTMLElement) => MountResult;

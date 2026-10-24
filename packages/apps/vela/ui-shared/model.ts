export type ConnectionState = "connected" | "connecting" | "offline" | "needs-auth";
export type ServiceState = "available" | "unavailable" | "checking";
/** How a service's bytes are carried: a web page for the browser, or a raw stream. */
export type ServiceProtocol = "http" | "tcp";

export interface ServiceViewModel {
  id: string;
  name: string;
  /** The loopback target shown under the name, e.g. `http://127.0.0.1:3080/` or `127.0.0.1:6379`. */
  subtitle: string;
  protocol: ServiceProtocol;
  /** Stable built-in kind; display names may be changed independently. */
  preset?: string;
  state: ServiceState;
  shared: boolean;
  url?: string;
  port?: number;
  adapter?: string;
  /** DSH only: the output log the sharing Mac reads the sign-in link from. */
  authLog?: string;
  /** DSH only: whether that log currently yields a sign-in link. */
  authLink?: DSHAuthLink;
}

/** `ready`: a link is published; `missing`: no launch line yet; `unreadable`: the log cannot be read. */
export type DSHAuthLink = "ready" | "missing" | "unreadable";

export interface DeviceViewModel {
  id: string;
  name: string;
  privateName: string;
  ips: string[];
  connection: ConnectionState;
  lastConnected: string;
  compatible: boolean;
  issue?: "offline" | "unauthorized" | "incompatible";
  services: ServiceViewModel[];
}

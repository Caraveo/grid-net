export type Scheme = "grid" | "http" | "https";

export interface GridUrl {
  scheme: Scheme;
  label: string;
  host: string;
  path: string;
  query: string | null;
  fragment: string | null;
  display: string;
}

export type BuiltinPage =
  | "home"
  | "site"
  | "registry"
  | "status"
  | "help"
  | "settings"
  | "error";

export type ResolveHit =
  | { kind: "builtin"; page: BuiltinPage; label: string }
  | { kind: "local"; label: string; origin: string }
  | {
      kind: "mesh";
      label: string;
      computeId: string;
      name: string;
      nodeId: string;
      image: string;
      visibility: string;
      status: string;
      freeSlots: number;
      replicas: number;
      class: string;
      backend: string;
    }
  | { kind: "gateway"; label: string; url: string }
  | { kind: "legacy"; url: string }
  | { kind: "not_found"; label: string; message: string }
  | { kind: "error"; message: string };

export interface NavigateResult {
  input: string;
  url: GridUrl | null;
  hit: ResolveHit | null;
  error: string | null;
}

export interface BrowserStatus {
  version: string;
  product: string;
  defaultScheme: string;
  registryUrl: string;
  namesPath: string;
  nameCount: number;
  gateway: string | null;
}

export interface RegistryNode {
  id: string;
  label: string;
  class: string;
  region: string;
  status: string;
  role?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface PublicCompute {
  id: string;
  name: string;
  nodeId: string;
  label?: string;
  image: string;
  visibility: string;
  class: string;
  backend?: string;
  replicas?: number;
  freeSlots?: number;
  status: string;
  lastSeen?: string | null;
}

export interface RegistryEntry {
  name: string;
  label: string;
  class: string;
  region: string;
  kinds: string[];
  nodeOnline: boolean;
  computeOnline: boolean;
  freeSlots: number;
  replicas: number;
  computeStatus: string | null;
  image: string | null;
  registeredAt: string;
}

export interface RegistrySnapshot {
  registry?: string | null;
  phase?: string | null;
  updatedAt?: string | null;
  peers: RegistryNode[];
  nodes: RegistryNode[];
  stats?: unknown;
  /** Paid+approved registry.grid directory */
  entries?: RegistryEntry[];
  rule?: string;
  computes?: PublicCompute[];
  computeStats?: {
    total?: number;
    available?: number;
    busy?: number;
    offline?: number;
    freeSlots?: number;
  };
  computeAvailableMs?: number;
}

export interface ComputesResponse {
  registry?: string | null;
  computes: PublicCompute[];
  stats?: RegistrySnapshot["computeStats"];
  availableMs?: number;
}

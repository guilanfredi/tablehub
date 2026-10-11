import type { RoomDurableObject } from './room-do';

export interface Env {
  ROOMS: DurableObjectNamespace<RoomDurableObject>;
  ASSETS: Fetcher;
}

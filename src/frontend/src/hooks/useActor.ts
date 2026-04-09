// Wrapper that binds the backend's createActor to the core-infrastructure useActor hook,
// so all query hooks can call useActor() without arguments.
import { useActor as useCoreActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export function useActor() {
  return useCoreActor(createActor);
}

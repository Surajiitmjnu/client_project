import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export async function reserveProductInventory({ orderReference, items }) {
  const reserve = httpsCallable(functions, "reserveProductInventory");
  const response = await reserve({ orderReference, items });
  return response.data;
}

export async function commitProductInventoryReservation({ orderReference }) {
  const commit = httpsCallable(functions, "commitProductInventoryReservation");
  const response = await commit({ orderReference });
  return response.data;
}

export async function releaseProductInventoryReservation({ orderReference }) {
  const release = httpsCallable(functions, "releaseProductInventoryReservation");
  const response = await release({ orderReference });
  return response.data;
}

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export async function approveB2BCreditOrder({ amount, orderReference }) {
  const approve = httpsCallable(functions, "approveB2BCreditOrder");
  const response = await approve({ amount, orderReference });
  return response.data;
}

export async function releaseB2BCreditOrder({ orderReference, approvalToken }) {
  const release = httpsCallable(functions, "releaseB2BCreditOrder");
  const response = await release({ orderReference, approvalToken });
  return response.data;
}

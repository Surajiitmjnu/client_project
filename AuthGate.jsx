import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/firebase";
import Login from "./src/pages/Login";
import { syncCustomerProfile } from "./src/utils/customerStore";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        void syncCustomerProfile(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  if (user === undefined) return null; // Loading state
  if (!user) return <Login />;
  return children;
}
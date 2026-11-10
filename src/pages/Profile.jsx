import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  getCustomerProfile,
  saveCustomerProfile,
  subscribeToCustomerProfile,
} from "../utils/customerStore";
import "./Profile.css";

const EMPTY_PROFILE = {
  fullName: "",
  phone: "",
  shopName: "",
  shopAddress: "",
  gstin: "",
  photoDataUrl: "",
};

function ProfileStatus({ status }) {
  const label = status || "Not submitted";
  return <span className={`profile-status ${label.toLowerCase().replace(" ", "-")}`}>{label}</span>;
}

export default function Profile() {
  const [user, setUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    const saved = getCustomerProfile(currentUser?.uid);
    setProfile({ ...EMPTY_PROFILE, ...saved });
  }), []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToCustomerProfile(user.uid, (remoteProfile) => {
      setProfile((current) => ({ ...current, ...remoteProfile }));
    }, (profileError) => {
      console.error("Unable to load verified customer profile:", profileError);
    });
  }, [user?.uid]);

  useEffect(() => {
    const refresh = (event) => {
      if (event.detail?.uid !== user?.uid) return;
      setProfile((current) => ({ ...current, ...event.detail }));
    };
    window.addEventListener("customer-profile-updated", refresh);
    return () => window.removeEventListener("customer-profile-updated", refresh);
  }, [user?.uid]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 500 * 1024) {
      setError("Choose an image smaller than 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfile((current) => ({ ...current, photoDataUrl: reader.result }));
    reader.onerror = () => setError("Unable to read that image.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      const saved = await saveCustomerProfile(user.uid, profile);
      setProfile(saved);
      setStatus("Details submitted. They must be verified before you can place an order.");
    } catch (saveError) {
      console.error("Unable to save customer profile:", saveError);
      setError("Unable to save your details. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-heading">
          <div>
            <p className="profile-eyebrow">MY ACCOUNT</p>
            <h1>Profile details</h1>
            <p>Complete your details to request account verification.</p>
          </div>
          <ProfileStatus status={profile.verificationStatus} />
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="profile-photo-field">
            {profile.photoDataUrl ? (
              <img src={profile.photoDataUrl} className="profile-photo-preview" alt="Profile" />
            ) : (
              <span className="profile-photo-placeholder">{(profile.fullName || user?.email || "?").charAt(0).toUpperCase()}</span>
            )}
            <label className="profile-photo-button">
              Change profile picture
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </div>

          <div className="profile-fields">
            <label>Full name<input required value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} /></label>
            <label>Mobile number<input required type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
            <label>Shop name<input required value={profile.shopName} onChange={(event) => setProfile({ ...profile, shopName: event.target.value })} /></label>
            <label>GSTIN number<input required pattern="[0-9A-Za-z]{15}" title="GSTIN must contain 15 letters and numbers" value={profile.gstin} onChange={(event) => setProfile({ ...profile, gstin: event.target.value.toUpperCase() })} /></label>
            <label className="profile-wide">Shop address<textarea required rows="3" value={profile.shopAddress} onChange={(event) => setProfile({ ...profile, shopAddress: event.target.value })} /></label>
          </div>

          {error && <p className="profile-error" role="alert">{error}</p>}
          {status && <p className="profile-success" role="status">{status}</p>}
          {profile.verificationStatus === "Verified" && <p className="profile-success">Your account is verified and you can place orders.</p>}
          <button className="profile-save-button" type="submit" disabled={isSaving}>{isSaving ? "Submitting..." : "Save details for verification"}</button>
        </form>
        <Link className="profile-orders-link" to="/orders">View order history</Link>
      </section>
    </main>
  );
}

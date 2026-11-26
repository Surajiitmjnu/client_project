import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  getCustomerProfileFieldError,
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
  const [saveRequest, setSaveRequest] = useState(null);
  const profileRef = useRef(profile);
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const userUidRef = useRef(user?.uid || "");
  const editedFieldsRef = useRef({});
  const pendingFieldsRef = useRef({});
  const validationErrorsRef = useRef({});

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    userUidRef.current = currentUser?.uid || "";
    editedFieldsRef.current = {};
    pendingFieldsRef.current = {};
    validationErrorsRef.current = {};
    setError("");
    setStatus("");
    const saved = getCustomerProfile(currentUser?.uid);
    const nextProfile = { ...EMPTY_PROFILE, ...saved };
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    setSaveRequest(null);
    saveRevisionRef.current += 1;
  }), []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToCustomerProfile(user.uid, (remoteProfile) => {
      const nextProfile = { ...profileRef.current };
      Object.entries(remoteProfile).forEach(([field, value]) => {
        if (!editedFieldsRef.current[field]) nextProfile[field] = value;
      });
      profileRef.current = nextProfile;
      setProfile(nextProfile);
    }, (profileError) => {
      console.error("Unable to load verified customer profile:", profileError);
      setError(profileError.message || "Unable to load your saved profile.");
    });
  }, [user?.uid]);

  useEffect(() => {
    const refresh = (event) => {
      if (event.detail?.uid !== user?.uid) return;
      const nextProfile = { ...profileRef.current };
      Object.entries(event.detail).forEach(([field, value]) => {
        if (!editedFieldsRef.current[field]) nextProfile[field] = value;
      });
      profileRef.current = nextProfile;
      setProfile(nextProfile);
    };
    window.addEventListener("customer-profile-updated", refresh);
    return () => window.removeEventListener("customer-profile-updated", refresh);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !saveRequest) return undefined;
    const { revision } = saveRequest;
    const timeout = window.setTimeout(() => {
      const uid = user.uid;
      setStatus("Saving...");
      saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
        if (uid !== userUidRef.current) return;
        const pending = { ...pendingFieldsRef.current };
        const now = Date.now();
        const entries = Object.entries(pending).filter(([, edit]) => edit.readyAt <= now);
        if (!entries.length) {
          setStatus("");
          return;
        }
        const patch = Object.fromEntries(entries.map(([field, edit]) => [field, edit.value]));
        await saveCustomerProfile(uid, patch);
        entries.forEach(([field, edit]) => {
          if (pendingFieldsRef.current[field]?.revision === edit.revision) {
            delete pendingFieldsRef.current[field];
          }
          if (editedFieldsRef.current[field]?.revision === edit.revision) {
            delete editedFieldsRef.current[field];
          }
        });
        if (!Object.keys(pendingFieldsRef.current).length) {
          const validationError = Object.values(validationErrorsRef.current).join(" ");
          setError(validationError);
          setStatus(validationError ? "" : "Saved successfully");
        } else if (Object.values(pendingFieldsRef.current).some((edit) => edit.readyAt <= Date.now())) {
          setStatus("Saving...");
        } else {
          setStatus("");
        }
      }).catch((saveError) => {
        console.error("Unable to save customer profile:", saveError);
        if (uid === userUidRef.current && revision <= saveRevisionRef.current) {
          const validationError = Object.values(validationErrorsRef.current).join(" ");
          const backendError = saveError.code
            ? `${saveError.code}: ${saveError.message}`
            : saveError.message;
          setStatus("");
          setError([backendError || "The profile could not be saved.", validationError].filter(Boolean).join(" "));
        }
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [saveRequest, user?.uid]);

  const updateProfile = (field, value) => {
    const nextProfile = { ...profileRef.current, [field]: value };
    const revision = ++saveRevisionRef.current;
    const fieldError = getCustomerProfileFieldError(field, value);
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    editedFieldsRef.current[field] = { value, revision };
    if (fieldError) {
      delete pendingFieldsRef.current[field];
      validationErrorsRef.current[field] = fieldError;
    } else {
      pendingFieldsRef.current[field] = { value, revision, readyAt: Date.now() + 600 };
      delete validationErrorsRef.current[field];
    }
    setError(Object.values(validationErrorsRef.current).join(" "));
    setStatus("");
    setSaveRequest({ revision });
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 500 * 1024) {
      setError("Choose an image smaller than 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateProfile("photoDataUrl", reader.result);
    reader.onerror = () => setError("Unable to read that image.");
    reader.readAsDataURL(file);
  };

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-heading">
          <div>
            <p className="profile-eyebrow">MY ACCOUNT</p>
            <h1>Profile details</h1>
            <p>Your profile details save automatically as you update them.</p>
          </div>
          <ProfileStatus status={profile.verificationStatus} />
        </div>

        <div className="profile-form">
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
            <label>Full name<input required value={profile.fullName} onChange={(event) => updateProfile("fullName", event.target.value)} /></label>
            <label>Mobile number<input required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" title="Mobile number must contain exactly 10 digits" value={profile.phone} onChange={(event) => updateProfile("phone", event.target.value)} /></label>
            <label>Shop name<input required value={profile.shopName} onChange={(event) => updateProfile("shopName", event.target.value)} /></label>
            <label>GSTIN number<input required pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[A-Z0-9]" maxLength="15" title="Enter a valid 15-character GSTIN" value={profile.gstin} onChange={(event) => updateProfile("gstin", event.target.value.toUpperCase())} /></label>
            <label className="profile-wide">Shop address<textarea required rows="3" value={profile.shopAddress} onChange={(event) => updateProfile("shopAddress", event.target.value)} /></label>
          </div>

          {error && <p className="profile-error" role="alert">{error}</p>}
          {status && <p className="profile-success" role="status">{status}</p>}
          {profile.verificationStatus === "Verified" && <p className="profile-success">Your account is verified and you can place orders.</p>}
        </div>
        <Link className="profile-orders-link" to="/orders">View order history</Link>
      </section>
    </main>
  );
}

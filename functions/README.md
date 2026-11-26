# Razorpay order function

The `createRazorpayOrder` callable creates INR Razorpay orders for authenticated customers whose Firestore profile is verified. It returns the Razorpay order ID, amount, currency, receipt, and public key ID. The key secret stays in Firebase Functions secrets.

Set credentials interactively so the secret is not added to source control:

```powershell
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase deploy --only functions:createRazorpayOrder
```

Use Razorpay test credentials when validating test-mode checkout.

# B2B credit approval

The `approveB2BCreditOrder` callable checks the authenticated customer's verified B2B profile and atomically reserves the requested amount against the customer's credit line and product inventory. It returns an approval token, available credit before the reservation, and remaining stock. If order creation fails, the client calls `releaseB2BCreditOrder` to release the credit and restore stock.

Set these fields on `customers/{uid}` for an approved B2B buyer:

- `verificationStatus`: `Verified`
- `customerType`: `B2B` (a business `shopName` or `gstin` also identifies a B2B profile)
- `creditLimit`: authorized limit in INR
- `creditOutstanding`: current outstanding amount in INR
- `paymentPeriodDays`: payment term in days (defaults to 30)

Each approved charge is recorded atomically in `CreditLedger` with the amount, balance before and after, timestamp, and due date. A reservation released after order-creation failure is marked reversed and receives a matching release entry.

The resulting order stores `paymentMethod: B2B_CREDIT`, `paymentStatus: UNSETTLED`, the approval token, `creditLedgerId`, and `settlementDeadline`. The order invoice includes the ledger reference and settlement deadline.

Deploy the callable functions with:

```powershell
firebase deploy --only functions:approveB2BCreditOrder,functions:releaseB2BCreditOrder
```

# Retail inventory reservations

Retail checkout calls `reserveProductInventory` before opening payment. The callable verifies the customer and reserves tracked product stock in one Firestore transaction, so overlapping checkouts cannot reduce inventory below zero. Successful orders commit the reservation; cancelled or failed checkouts call `releaseProductInventoryReservation` to restore stock. The reservation operations are idempotent for a customer and order reference.

Deploy the retail reservation callables with:

```powershell
firebase deploy --only functions:reserveProductInventory,functions:commitProductInventoryReservation,functions:releaseProductInventoryReservation
```

# Product CSV import authorization

The `importProductCatalog` callable verifies the Firebase ID token and authorizes only users with a `role` claim of `STORE_OWNER` or `WAREHOUSE_STAFF`, or a `roles` claim array containing either value. Retail users receive `permission-denied`; unauthenticated requests receive `unauthenticated`. The admin portal uses Firebase Authentication and requires one of these role claims.

Deploy the protected importer with:

```powershell
firebase deploy --only functions:importProductCatalog
```

# Order email retry queue

Order confirmation emails are written to the `mail` collection after the order is saved, so an email-provider outage does not block order placement. The Firebase Trigger Email extension must be configured to watch this collection. The `retryFailedEmails` scheduled function checks delivery failures each minute and changes eligible `delivery.state: ERROR` documents to `RETRY`. The delay doubles from 1 minute to a 1-hour maximum, based on the extension's delivery attempt count.

The scheduled entry point delegates retry coordination to `services/emailRetryService.js`, which uses `repositories/emailRetryRepository.js` for Firestore access.

Deploy the scheduled retry function with:

```powershell
firebase deploy --only functions:retryFailedEmails
```

Verify a provider outage by checking that the order remains created, the mail document records `delivery.state: ERROR`, and its `delivery.attempts` increases after the provider is restored.

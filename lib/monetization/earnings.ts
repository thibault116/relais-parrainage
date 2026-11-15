// Shared allocation register includes historical Stripe reservations, so a gain
// can never be withdrawn again through the manual flow.
export const eligibleSql=`SELECT b.id,b.payout_cents,b.credits,b.snapshot FROM money_bookings b
  JOIN money_services s ON s.id=b.service_id
  LEFT JOIN money_connect_allocations a ON a.booking_id=b.id
  WHERE s.owner_id=$1 AND b.status='completed' AND b.payout_cents>0 AND a.booking_id IS NULL
  ORDER BY b.created_at,b.id`;

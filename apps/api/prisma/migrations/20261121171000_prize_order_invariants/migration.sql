ALTER TABLE orders ADD CONSTRAINT prize_order_payment_shape CHECK (
  (payment_method::text = 'contest_prize') = (payment_status::text = 'not_required')
);
ALTER TABLE orders ADD CONSTRAINT prize_order_zero_amounts CHECK (
  payment_method::text <> 'contest_prize' OR (
    status::text = 'fulfillment_ready' AND
    subtotal = 0 AND discount = 0 AND total = 0 AND delivery_price = 0 AND
    paid_at IS NULL AND sponsored_delivery_price IS NOT NULL AND sponsored_delivery_price >= 0
  )
);

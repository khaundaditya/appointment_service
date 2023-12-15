DROP VIEW public.mv_appointments;
 
 -- rename payments related old table
 ALTER TABLE IF EXISTS public.payments_invoice
 RENAME TO public.payments_invoice_old;
 
 ALTER TABLE IF EXISTS public.payments_invoice_details
 RENAME TO public.payments_invoice_details_old;
 
 -- create new view
 CREATE OR REPLACE VIEW public.mv_appointments
  AS
  SELECT asb.appointment_id,
     asb.exp_start_date,
     asb.exp_end_date,
     asb.cutter_id,
     asb.store_id,
     aa.tenant_id,
     aa.client_id,
     aa.appointment_time,
     aa.status,
     aa.card_details,
     aa.checkin_time,
     aa.checkout_time,
     aa.total_tax,
     aa.total_price,
     aa.is_cancelled,
     aa.cancellation_charge,
     aa.cancellation_reason,
     asb.service_id,
     asb.package_id,
     asb.price,
     asb.discount,
     asb.service_discount,
     asb.service_discounted_price,
     asb.guest_user_id,
     asb.service_option_id,
     asb.service_option_name,
     asb.service_option_price,
     asb.guest_name,
     pi.id AS invoice_id,
     pi.status AS invoice_status,
     pi.payment_status,
     pi.is_cancelled AS invoice_cancelled,
     cu.email AS customer_email,
     cu.phone AS customer_phone,
     asb.service_or_package_name,
     asb.approx_time,
     asb.service_name,
     asb.service_price,
     aa.appointment_end_time,
     aa.appointment_uniq_id,
     aa.payment_mode
    FROM public.appointment_appointment aa
      JOIN public.appointment_service_booked asb ON asb.appointment_id = aa.id
      LEFT JOIN public.payments_invoice_old pi ON pi.appointment_id = aa.id
      LEFT JOIN public.customer_user cu ON cu.id = aa.client_id
   WHERE aa.status::text IS NOT NULL;
	 
 INSERT INTO public.version(version_number, service_name)
 VALUES (1.3, 'appointment');
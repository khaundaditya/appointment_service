-- View: public.mv_appointments
-- DROP VIEW public.mv_appointments;
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
    aa.appointment_uniq_id
   FROM appointment_appointment aa
     JOIN appointment_service_booked asb ON asb.appointment_id = aa.id
     LEFT JOIN payments_invoice pi ON pi.appointment_id = aa.id
     LEFT JOIN customer_user cu ON cu.id = aa.client_id
  WHERE aa.status::text IS NOT NULL;
ALTER TABLE public.mv_appointments
    OWNER TO postgres;
INSERT INTO version (version_number, service_name) VALUES ('1.8', 'appointment');
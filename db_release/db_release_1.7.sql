DROP VIEW public.mv_customer;

CREATE OR REPLACE VIEW public.mv_customer
  AS
 SELECT cu.id AS customer_id,
    cu.first_name,
    cu.last_name,
    cu.cognito_id,
    cu.phone,
    cu.device_type,
    cu.device_token,
    cu.login_type,
    cu.tenant_id,
    ca.address,
    ca.street_name,
    ca.city,
    ca.state_id,
    ca.zipcode,
    ca.suite_number,
    cp.fullname,
    cp.profile_image_url,
    cu.dob,
    cp.fav_services,
    cp.fav_cutters,
    cp.fav_stores,
    cu.email,
    cu.gender,
    cpref.preference,
    cm.type AS message_type,
    cm.data,
    ccards.card_holder_name,
    ccards.card_number,
    ccards.pg_name,
    ccards.pg_customer_id,
    ccards.card_type,
    ccards.is_default,
    ccards.is_active,
    ccards.expiry_date,
    ca.lat,
    ca.long,
	  cu.preferred_phone
   FROM customer_user cu
     LEFT JOIN customer_profile cp ON cu.id = cp.customer_user_id
     LEFT JOIN customer_preference cpref ON cu.id = cp.customer_user_id
     LEFT JOIN customer_address ca ON cu.id = ca.customer_id
     LEFT JOIN customer_cards ccards ON cu.id = ccards.customer_user_id
     LEFT JOIN customer_messages cm ON cu.id = cm.customer_id;

INSERT INTO public.version(version_number, service_name) VALUES (1.7, 'appointment');
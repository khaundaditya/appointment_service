ALTER TABLE appointment_appointment
ADD appointment_end_time TIMESTAMP WITHOUT TIME ZONE NULL;

ALTER TABLE appointment_service_booked
ADD extra_time INTEGER NULL;

ALTER TABLE appointment_service_booked
ADD cancellation_reason text NULL;

ALTER table appointment_appointment
ALTER column checkin_time DROP NOT NULL;

ALTER table appointment_appointment
ALTER column checkout_time DROP NOT NULL;

ALTER TABLE appointment_service_booked
ADD extra_time INTEGER NULL;

ALTER TABLE appointment_appointment
ADD extra_time INTEGER NULL;

CREATE TABLE IF NOT EXISTS public.customer_walkout
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    cutter_id uuid NOT NULL,
    service_id uuid NOT NULL,
    date timestamp without time zone NOT NULL,
    "time" character varying COLLATE pg_catalog."default" NOT NULL,
    customer_name character varying(20) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    CONSTRAINT customer_walkout_pk PRIMARY KEY (id)
)

ALTER TABLE appointment_appointment
ADD beverages json NULL;

ALTER TABLE appointment_appointment
ADD music json NULL;

INSERT INTO version (version_number, service_name) VALUES ('1.1', 'appointment');

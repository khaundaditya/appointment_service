DROP VIEW public.mv_cutter_schedule;

CREATE OR REPLACE VIEW public.mv_cutter_schedule
  AS
 WITH employee_skill_details AS (
         SELECT cs.skill_name AS speciality,
            es.employee_user_id AS employee_id
           FROM employee_skills es
             LEFT JOIN service_skills cs ON cs.id = es.skill_id
        ), employee_basic_details AS (
         SELECT ed.primary_contact,
            ed.bio_summary AS bio,
            eu.firstname,
            eu.lastname,
            eu.email,
            eu.is_deleted,
            ei.image,
            ef.feedback AS user_reviews,
            ef.id AS review_id,
            ef.review_data,
            ef.status AS feedback_status,
            esd_1.speciality,
            eu.id AS employee_id,
            ed.billing_rate,
            eu.status,
            ed.logo
           FROM employee_user eu
             LEFT JOIN employee_skill_details esd_1 ON eu.id = esd_1.employee_id
             LEFT JOIN employee_userdetail ed ON eu.id = ed.employee_user_id
             LEFT JOIN employee_image ei ON eu.id = ei.employee_user_id
             LEFT JOIN employee_feedback ef ON eu.id = ef.employee_user_id
        ), employee_shift_details AS (
         SELECT es.tenant_id,
            es.employee_user_id,
            es.store_id,
            es.shift_type,
            es.shift_start_time,
            es.shift_end_time,
            es.cutter_name,
            es.number_of_hours,
            eso.number_of_hours AS total_overtime_hours,
			      es.status AS shift_status
           FROM employee_schedule es
             LEFT JOIN employee_shift_overtime eso ON es.id = eso.employee_schedule_id
        )
 SELECT ebd.primary_contact,
    ebd.bio,
    ebd.firstname,
    ebd.lastname,
    ebd.email,
    ebd.image,
    ebd.user_reviews,
    ebd.speciality,
    ebd.employee_id,
    ebd.is_deleted,
    esd.tenant_id,
    ebd.employee_id AS employee_user_id,
    esd.store_id,
    esd.shift_type,
    esd.shift_start_time,
    esd.shift_end_time,
    concat(ebd.firstname, ' ', ebd.lastname) AS cutter_name,
    esd.number_of_hours,
    esd.total_overtime_hours,
    ebd.billing_rate,
    ebd.feedback_status,
    ebd.logo,
    ebd.review_data,
    ebd.review_id,
    ebd.status,
	  esd.shift_status
   FROM employee_basic_details ebd
     LEFT JOIN employee_shift_details esd ON esd.employee_user_id = ebd.employee_id;

INSERT INTO public.version(version_number, service_name) VALUES (1.6, 'appointment');
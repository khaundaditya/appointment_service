update config_franchisor_config set value = '{"cart_timer_mins": "15", "near_by_distance":"10",
"checkin_time_limit": "15" }' where category = 'appointment_service_config'

INSERT INTO version (version_number, service_name) VALUES ('1.6', 'appointment');
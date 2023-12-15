export class Constant {
  public static readonly REDIS = {
    TTL: 15 * 60, // 15 mins
    userCartKey: `backend_${process.env.MODE}_user_cart_`,
    userSerivceCartKey: `backend_${process.env.MODE}_user_cart_service_`,
    expireMinutes: 15,
    service_key: `backend_appointment_service_${process.env.MODE}_`,
    userMusicBeverageKey: `backend_${process.env.MODE}_user_music_beverage_`,
    TTL_IN_MIN: 15,
    userGuestKey: `backend_${process.env.MODE}_user_guest_`,
    distanceKey: `backend_${process.env.MODE}_store_distance_`,
    storeDetailTTL: 24 * 60 * 60, // 1 day,
    editAppointmentSlotKey: `backend_${process.env.MODE}_edit_appointment_slots_`,
  };

  public static readonly slot_round_off_time = 5;
  public static readonly max_service_in_cart = 2;

  public static readonly DATE_FORMAT = {
    YMD_HMD: 'YYYY-MM-DD HH:mm:ss',
    YMD_THMD: 'YYYY-MM-DDTHH:mm:ss',
    YMD_HMD_START: 'YYYY-MM-DDT00:00:00',
    YMD_HMD_END: 'YYYY-MM-DDT23:59:59',
    YMD_HMD_START_SECOND: 'YYYY-MM-DD HH:mm:00',
    YMD: 'YYYY-MM-DD',
    LLL: 'LLL',
    DDDD: 'dddd',
  };

  public static readonly DEVICE_TYPE = {
    KIOSK: 'kiosk',
    PORTAL: 'portal',
  };

  public static readonly API_TYPE = {
    WALK_IN: 'walkin',
  };

  public static readonly WEEK_DAYS = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };

  public static readonly appointment_status = [
    'booked',
    'checked_in',
    'checked_out',
    'ongoing',
    'completed',
    'rescheduled',
    'pending',
  ];

  public static readonly timezones = {
    AST: 'America/Blanc-Sablon',
    CST: 'America/chicago',
    EST: 'EST',
    MST: 'MST',
    PST: 'America/Los_Angeles',
    AKST: 'America/Anchorage',
    HST: 'HST',
    GMT: 'GMT',
    UTC: 'GMT',
    utc: 'GMT',
  };

  public static readonly static_timezone_pair = {
    AST: 'America/Blanc-Sablon',
    CST: 'America/chicago',
    EST: 'America/New_York',
    MST: 'America/Cambridge_Bay',
    PST: 'America/Los_Angeles',
    AKST: 'America/Anchorage',
    HST: 'America/Adak',
    GMT: 'America/Danmarkshavn',
    UTC: 'GMT',
    utc: 'GMT',
  };

  public static readonly checkout_time_minutes = 15;
  public static readonly sleeping_time = 30;
  public static readonly max_day_slots_check = 2;
  public static readonly time_gap_between_slots = 0;
  public static readonly max_slots_caraousel = 2;
  public static readonly max_guest_limit = 1;

  public static readonly cloudinary = 'Cloudinary';
}

export class Language {
  public static readonly SUCESS = {
    MSG_CARASOUL_SERVICE: 'Flagship service list fetched successfully.',
    MSG_AVAILABLE_SLOTS: 'Slots fetched successfully.',
    MSG_SERVICE_ADD_CART: 'Service is added to cart successfully.',
    MSG_GET_CART_DETAILS: 'Cart details fetched successfully.',
    MSG_UPDATE_CART_DETAILS: 'Cart details updatd sucessfully.',
    MSG_SERVICE_ADD_TO_CART: 'Service added to cart successfully.',
    MSG_CART_UPDATE: 'Cart updated successfully.',
    MSG_INSTRUCTION_ADD: 'Instruction added successfully.',
    MSG_CART_REMOVE: 'Cart item removed successfully.',
    MSG_BOOK_APPOINTMENT: 'Your appointment has been booked successfully.',
    MSG_REIDS_KEY_UPDATE: 'Redis key updated successfully.',
    MSG_CLEAR_SLOTS: 'Previously booked slots are cleared.',
    MSG_NEW_SLOT_TIME:
      'If you remove this service then new appointment time will be <appointment start> , are you sure you want to continue?',
    MSG_GUEST_MANAGE: 'Guest updated successfully.',
  };

  public static readonly ERROR = {
    ERR_STORE_NOT_FOUND: 'Store not found',
    ERR_STORE_CLOSED: 'Store is closed on this day.',
    ERR_SERVICE_NOT_FOUND: 'Services not found',
    ERR_INAVCTIVE_CUTTER:
      'Selected cutter or service is no more available Please try our other services or cutter.',
    ERR_ALREADYADD_CART: 'Selected slot is already booked',
    ERR_ALREADYADD_YOU_CART: 'Selected slot for you is already booked',
    ERR_ALREADYADD_GUEST_CART: 'Selected slot for guest is already booked',
    ERR_TENANT_ID: 'tenant_id is missing',
    ERR_CART_NOT_FOUND: 'Cart not found.',
    ERR_STORE_INACTIVE: "Store is inactive. You can't book from this store",
    ERR_CUTTER_NOT_AVAILABLE:
      'Selected slot is already booked, please choose some other slot and retry',
    ERR_CART_ITEM_NOT_FOUND: 'Cart item not found.',
    ERR_ALREADY_BOOKED:
      'You have already booked another cutter for this time duration',
    ERR_REACHED_MAX_CART_LIMIT:
      'You have reached max cart limit for the service',
    ERR_CART_CONFIRMATION:
      'Will reset your previous slot. Do you want to continue?',
    ERR_DIFFERENT_STORE_SERVICE:
      "It seems you have already added service in another store and you are trying to book service in different store. Your previous store's services will be removed.",
    ERR_CART_SERVICE_INACTIVE:
      'Sorry for the inconvenience, selected service is no longer available Please select another service',
    ERR_CART_ITEM_MUL_ITEM:
      'We will be booking multiple appointments, as the picked time are not in continuation. Do you want to Continue?',
    ERR_BOOK_APPOINTMENT_POPUP: 'There are some services already exist in cart',
    ERR_GUEST_USER_SERVICE_ID:
      'It seems you are trying to add same service for guest user',
    ERR_CUSTOMER_SERVICE_ID:
      'It seems you are trying to add same service for customer',
    ERR_GUEST_ADD: 'You can not add more than 2 guests',
    ERR_SLOT_CONTINUATION:
      ' The slots are not in continuation please choose different slots',
    ERR_PREVIOUS_DAY_SERVICE_SELECTION:
      'It seems you are trying to select previous day or current day earlier slot',
    ERR_INVALID_PIN: 'Pin not found',
  };

  public static readonly NOTIFICATION = {
    UPCOMING_APPT_TITLE: 'Upcoming Appointment',
  };
}

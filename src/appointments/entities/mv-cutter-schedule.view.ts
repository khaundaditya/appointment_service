import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity()
export class MvCutterSchedule {
  @ViewColumn()
  primary_contact: string;

  @ViewColumn()
  bio: string;

  @ViewColumn()
  firstname: string;

  @ViewColumn()
  lastname: string;

  @ViewColumn()
  email: string;

  @ViewColumn()
  image: string;

  @ViewColumn()
  user_reviews: string;

  @ViewColumn()
  speciality: string;

  @ViewColumn()
  employee_id: string;

  @ViewColumn()
  tenant_id: string;

  @ViewColumn()
  employee_user_id: string;

  @ViewColumn()
  store_id: string;

  @ViewColumn()
  shift_type: string;

  @ViewColumn()
  shift_start_time: Date;

  @ViewColumn()
  shift_end_time: Date;

  @ViewColumn()
  cutter_name: string;

  @ViewColumn()
  number_of_hours: number;

  @ViewColumn()
  total_overtime_hours: number;

  @ViewColumn()
  billing_rate: number;

  @ViewColumn()
  status: string;

  @ViewColumn()
  logo: string;

  public static from(entity: Partial<MvCutterSchedule>) {
    const it = new MvCutterSchedule();
    it.primary_contact = entity.primary_contact;
    it.bio = entity.bio;
    it.firstname = entity.firstname;
    it.lastname = entity.lastname;
    it.email = entity.email;
    it.image = entity.image;
    it.user_reviews = entity.user_reviews;
    it.speciality = entity.speciality;
    it.employee_id = entity.employee_id;
    it.tenant_id = entity.tenant_id;
    it.employee_user_id = entity.employee_user_id;
    it.store_id = entity.store_id;
    it.shift_type = entity.shift_type;
    it.shift_start_time = entity.shift_start_time;
    it.shift_end_time = entity.shift_end_time;
    it.cutter_name = entity.cutter_name;
    it.number_of_hours = entity.number_of_hours;
    it.total_overtime_hours = entity.total_overtime_hours;
    it.billing_rate = entity.billing_rate;
    it.status = entity.status;
    it.logo = entity.logo;
    return it;
  }
}

import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { CustomerPreference } from './customer-preference.entity';

@Entity({ name: 'customer_user' })
export class CustomerUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  first_name: string;

  @Column({ type: 'varchar' })
  last_name: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar' })
  preferred_phone: string;

  @Column({ type: 'varchar' })
  device_token: string;

  @Column({ type: 'varchar' })
  gender: string;

  @Column({ type: 'varchar' })
  fullname: string;

  @Column({ type: 'varchar' })
  profile_image_url: string;

  @Column({ type: 'timestamptz' })
  dob: string;

  @Column({ type: 'uuid' })
  cognito_id: string;

  @OneToOne(() => CustomerPreference)
  @JoinColumn({ name: 'id', referencedColumnName: 'customer_user_id' })
  customer_preference: CustomerPreference;
}

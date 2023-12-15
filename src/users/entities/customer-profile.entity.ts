import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'customer_profile' })
export class CustomerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  fullname: string;

  @Column({ type: 'varchar' })
  profile_image_url: string;

  @Column({ type: 'timestamptz' })
  dob: string;

  @Column({ type: 'uuid' })
  customer_user_id: string;

  @Column({ type: 'varchar' })
  gender: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar' })
  email: string;
}

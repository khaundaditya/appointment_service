import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'customer_guest_user' })
export class CustomerGuestUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  mobile: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'uuid' })
  tenant_id: string;
}
